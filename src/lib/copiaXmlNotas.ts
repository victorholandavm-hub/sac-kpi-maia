import { mkdir, readFile, statfs, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { pastaNotas } from "./notaEntregaProtheus";

// Cópia de madrugada do XML das notas de venda do Protheus -- Victor
// 27/10/2026 (guarda de 5 anos: a ponte lê o SPED do Protheus, e se o
// Protheus for desligado as notas somem). Pela chave de totvs_orders, na
// ponte do Pedro (GET /nota/<chave>/xml, ~0,9 s, ~10 KB), 2 por vez. Dia a
// dia, das vendas mais novas pras mais antigas; em cada dia baixa só o que
// falta em protheus_notas_xml (0215). Para com o disco abaixo de 3 GB.

const SIMULTANEAS = 2;
const TIMEOUT_MS = 30_000;
const PISO_DISCO_BYTES = 3 * 1024 ** 3;
const ULTIMO_DIA = "2026-10-24";
const PRIMEIRO_DIA = "2021-01-01";

type Venda = { invoice: string; branch: string; nfe_key: string };

export function chavesQueFaltam(vendas: Venda[], jaTem: Set<string>): Venda[] {
  const vistas = new Set<string>();
  return vendas.filter((v) => {
    const c = (v.nfe_key ?? "").replace(/\D/g, "");
    if (c.length !== 44 || jaTem.has(c) || vistas.has(c)) return false;
    vistas.add(c);
    return true;
  });
}

// XML de uma nota pela chave: a cópia guardada (notas de venda do Protheus)
// ou a ponte -- pra DANFE da nota de venda que a ponte não imprime (danfe.ts).
export async function xmlDaNota(chave: string): Promise<string> {
  const c = chave.replace(/\D/g, "");
  if (c.length !== 44) throw new Error("Chave da nota inválida.");
  const guardado = await readFile(join(pastaNotas(), `${c}.xml`), "utf-8").catch(() => null);
  return guardado ?? baixarXml(c);
}

async function baixarXml(chave: string): Promise<string> {
  const base = (process.env.ODOO_BRIDGE_URL ?? "").replace(/\/+$/, "");
  const r = await fetch(`${base}/nota/${chave}/xml`, {
    headers: { "X-Maia-Perfil": "logistica", "X-Maia-Key": process.env.ODOO_KEY_LOGISTICA ?? "" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`ponte respondeu ${r.status}`);
  const xml = await r.text();
  if (!xml.trimStart().startsWith("<")) throw new Error("resposta não é XML");
  return xml;
}

function diaAnterior(dia: string): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export type ResumoXml = { dias: number; baixados: number; falhas: number; parouPor: string };

export async function copiarXmlNotasDeVenda(limiteMs: number, desde = PRIMEIRO_DIA): Promise<ResumoXml> {
  const admin = getSupabaseAdmin();
  const inicio = Date.now();
  const pasta = pastaNotas();
  await mkdir(pasta, { recursive: true });
  const resumo: ResumoXml = { dias: 0, baixados: 0, falhas: 0, parouPor: "fim" };

  for (let dia = ULTIMO_DIA; dia >= desde; dia = diaAnterior(dia)) {
    if (Date.now() - inicio > limiteMs) return { ...resumo, parouPor: "tempo" };
    const s = await statfs(pasta).catch(() => statfs(dirname(pasta)));
    if (s.bavail * s.bsize < PISO_DISCO_BYTES) return { ...resumo, parouPor: "disco" };

    const [{ data: vendas, error }, { data: feitas }] = await Promise.all([
      admin.from("totvs_orders").select("invoice, branch, nfe_key").eq("issue_date", dia).eq("type", "Venda").not("nfe_key", "is", null).limit(5000).returns<Venda[]>(),
      admin.from("protheus_notas_xml").select("chave").eq("issue_date", dia).limit(5000).returns<{ chave: string }[]>(),
    ]);
    if (error) throw new Error(error.message);
    const faltam = chavesQueFaltam(vendas ?? [], new Set((feitas ?? []).map((f) => f.chave)));
    resumo.dias++;
    for (let i = 0; i < faltam.length; i += SIMULTANEAS) {
      if (Date.now() - inicio > limiteMs) return { ...resumo, parouPor: "tempo" };
      await Promise.all(
        faltam.slice(i, i + SIMULTANEAS).map(async (v) => {
          const chave = v.nfe_key.replace(/\D/g, "");
          try {
            const xml = await baixarXml(chave);
            await writeFile(join(pasta, `${chave}.xml`), xml, "utf-8");
            await admin
              .from("protheus_notas_xml")
              .upsert({ chave, invoice: v.invoice, branch: v.branch, issue_date: dia, bytes: Buffer.byteLength(xml) }, { onConflict: "chave" });
            resumo.baixados++;
          } catch {
            resumo.falhas++;
          }
        })
      );
      if (resumo.falhas >= 50 && resumo.falhas > resumo.baixados) return { ...resumo, parouPor: "falhas" };
    }
  }
  return resumo;
}
