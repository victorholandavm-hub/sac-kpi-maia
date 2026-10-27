import https from "node:https";
import { mkdir, readFile, statfs, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { photoStorageDir } from "./localPhotoStorage";
import { consertarAcentos, totvsHeaders } from "./totvsSync";

// Nota de entrega (remessa, CFOP 5117) das vendas do Protheus -- Victor
// 27/10/2026. O Protheus está congelado mas a API original ainda responde:
// /ai/deliveries/nota/{filial}/{pedido}/{id} devolve o PDF (nfeBase64) e o
// XML (nfeXml) da nota da saída. Cada nota buscada fica no disco
// (NOTAS_PROTHEUS_DIR/<chave>.pdf|.xml) e no índice protheus_notas_entrega
// (0208), pra continuar existindo quando o Protheus for desligado. A nota de
// VENDA (5922) não vem por aqui -- só a chave, em totvs_orders.
//
// TOTVS_API_BASE_URL aponta pra compat do Pedro desde 26/10; o Protheus
// original fica em PROTHEUS_ARQUIVO_URL. Certificado interno da TOTVS (mesmo
// motivo do insecureAgent do totvsSync.ts). No máximo 2 chamadas ao mesmo
// tempo (regra da API do Protheus).

const BASE = (process.env.PROTHEUS_ARQUIVO_URL ?? "https://protheus.lojasmaia.com.br:8400/rest").replace(/\/+$/, "");
const agente = new https.Agent({ rejectUnauthorized: false });
const TIMEOUT_MS = 60_000;
const SIMULTANEAS = 2;

export function pastaNotas(): string {
  return process.env.NOTAS_PROTHEUS_DIR ?? join(dirname(photoStorageDir()), "notas-protheus");
}

let emUso = 0;
const fila: (() => void)[] = [];
async function comVaga<T>(fn: () => Promise<T>): Promise<T> {
  if (emUso >= SIMULTANEAS) await new Promise<void>((ok) => fila.push(ok));
  emUso++;
  try {
    return await fn();
  } finally {
    emUso--;
    fila.shift()?.();
  }
}

function getProtheus(caminho: string): Promise<{ status: number; corpo: string }> {
  return comVaga(
    () =>
      new Promise((ok, falha) => {
        const req = https.get(`${BASE}${caminho}`, { headers: totvsHeaders(), agent: agente, timeout: TIMEOUT_MS }, (res) => {
          const partes: Buffer[] = [];
          res.on("data", (p: Buffer) => partes.push(p));
          res.on("end", () => ok({ status: res.statusCode ?? 0, corpo: Buffer.concat(partes).toString("utf-8") }));
        });
        req.on("timeout", () => req.destroy(new Error(`Protheus não respondeu em ${TIMEOUT_MS / 1000} s`)));
        req.on("error", falha);
      })
  );
}

export type NotaEntregaProtheus = {
  chave: string;
  filial: string;
  pedido: string;
  zae_id: string;
  nota: string | null;
  serie: string | null;
  cfop: string | null;
  emissao: string | null;
  tem_pdf: boolean;
  tem_xml: boolean;
};

type RespostaNota = { invoice?: string; serie?: string; dataEmissao?: string; chave?: string; cfop?: string | string[]; nfeXml?: string; nfeBase64?: string };
type ItemEntrega = { branch?: string; order?: string; id?: string };
type ListaEntregas = { totalPages?: number; data?: ItemEntrega[] } | ItemEntrega[];

const so = (v: string | undefined) => (v ?? "").trim();

// Busca a nota da saída no Protheus e guarda. null = saída sem nota impressa
// (o Protheus responde 404 enquanto a DANFE não foi gerada).
export async function baixarNotaDaSaida(filial: string, pedido: string, zaeId: string): Promise<NotaEntregaProtheus | null> {
  const r = await getProtheus(`/ai/deliveries/nota/${encodeURIComponent(filial)}/${encodeURIComponent(pedido)}/${encodeURIComponent(zaeId)}`);
  if (r.status === 404) return null;
  if (r.status !== 200) throw new Error(`Protheus respondeu ${r.status}: ${r.corpo.slice(0, 120)}`);
  const n = JSON.parse(consertarAcentos(r.corpo)) as RespostaNota;
  const chave = so(n.chave).replace(/\D/g, "");
  if (chave.length !== 44) return null;
  const pasta = pastaNotas();
  await mkdir(pasta, { recursive: true });
  if (n.nfeBase64) await writeFile(join(pasta, `${chave}.pdf`), Buffer.from(n.nfeBase64, "base64"));
  if (n.nfeXml) await writeFile(join(pasta, `${chave}.xml`), n.nfeXml, "utf-8");
  const linha: NotaEntregaProtheus = {
    chave,
    filial,
    pedido,
    zae_id: zaeId,
    nota: so(n.invoice).replace(/^0+/, "") || null,
    serie: so(n.serie) || null,
    cfop: (Array.isArray(n.cfop) ? n.cfop.join(",") : so(n.cfop)) || null,
    emissao: /^\d{4}-\d{2}-\d{2}/.test(so(n.dataEmissao)) ? so(n.dataEmissao).slice(0, 10) : null,
    tem_pdf: !!n.nfeBase64,
    tem_xml: !!n.nfeXml,
  };
  const { error } = await getSupabaseAdmin().from("protheus_notas_entrega").upsert(linha, { onConflict: "chave" });
  if (error) throw new Error(error.message);
  return linha;
}

// Notas de entrega do pedido: primeiro as já guardadas; se não tem nenhuma,
// procura as saídas do cliente no Protheus (pelo CPF/CNPJ) e baixa.
export async function notasEntregaDoPedido(filial: string, pedido: string, documento: string | null): Promise<NotaEntregaProtheus[]> {
  const admin = getSupabaseAdmin();
  const { data } = await admin.from("protheus_notas_entrega").select("*").eq("filial", filial).eq("pedido", pedido).order("emissao", { ascending: false }).returns<NotaEntregaProtheus[]>();
  if (data?.length) return data;
  const doc = (documento ?? "").replace(/\D/g, "");
  if (!doc) return [];
  const r = await getProtheus(`/ai/deliveries?document=${doc}&page=1&size=50`);
  if (r.status !== 200) throw new Error(`Protheus respondeu ${r.status}`);
  const lista = JSON.parse(consertarAcentos(r.corpo)) as ListaEntregas;
  const itens = (Array.isArray(lista) ? lista : lista.data ?? []).filter((i) => so(i.order) === pedido && so(i.branch) === filial && so(i.id));
  const notas: NotaEntregaProtheus[] = [];
  for (const i of itens) {
    const n = await baixarNotaDaSaida(filial, pedido, so(i.id));
    if (n) notas.push(n);
  }
  return notas.sort((a, b) => (b.emissao ?? "").localeCompare(a.emissao ?? ""));
}

export function lerPdfNota(chave: string): Promise<Buffer> {
  const c = chave.replace(/\D/g, "");
  if (c.length !== 44) throw new Error("Chave inválida.");
  return readFile(join(pastaNotas(), `${c}.pdf`));
}

// ---------------------------------------------------------------- cópia de madrugada

const PISO_DISCO_BYTES = 3 * 1024 ** 3;
const PRIMEIRO_DIA = "2024-01-01";
const ULTIMO_DIA = "2026-10-24"; // última venda do Protheus

export type ResumoCopia = { dias: string[]; entregas: number; notas: number; jaTinha: number; semNota: number; falhas: number; parouPor: string | null };

async function discoLivre(): Promise<number> {
  const s = await statfs(pastaNotas()).catch(() => statfs(dirname(pastaNotas())));
  return s.bavail * s.bsize;
}

function diaAnterior(dia: string): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// Do dia mais novo ainda não copiado pro mais antigo, até acabar o tempo.
export async function copiarNotasDeEntrega(limiteMs: number, desde = PRIMEIRO_DIA): Promise<ResumoCopia> {
  const admin = getSupabaseAdmin();
  const inicio = Date.now();
  const resumo: ResumoCopia = { dias: [], entregas: 0, notas: 0, jaTinha: 0, semNota: 0, falhas: 0, parouPor: null };
  const { data: feitos } = await admin.from("protheus_notas_copia").select("dia").returns<{ dia: string }[]>();
  const copiados = new Set((feitos ?? []).map((f) => f.dia));
  await mkdir(pastaNotas(), { recursive: true });

  for (let dia = ULTIMO_DIA; dia >= desde; dia = diaAnterior(dia)) {
    if (copiados.has(dia)) continue;
    if (Date.now() - inicio > limiteMs) return { ...resumo, parouPor: "tempo" };
    if ((await discoLivre()) < PISO_DISCO_BYTES) return { ...resumo, parouPor: "disco" };

    const d = dia.replace(/-/g, "");
    const doDia = { entregas: 0, notas: 0, semNota: 0, falhas: 0 };
    for (let pagina = 1, total = 1; pagina <= total; pagina++) {
      const r = await getProtheus(`/ai/deliveries?deliveryDateFrom=${d}&deliveryDateTo=${d}&page=${pagina}&size=50`);
      if (r.status !== 200) throw new Error(`Protheus respondeu ${r.status} na lista de ${dia}`);
      const lista = JSON.parse(consertarAcentos(r.corpo)) as ListaEntregas;
      total = Array.isArray(lista) ? 1 : (lista.totalPages ?? 1);
      const itens = (Array.isArray(lista) ? lista : lista.data ?? []).filter((i) => so(i.order) && so(i.branch) && so(i.id));
      doDia.entregas += itens.length;
      const { data: jaTem } = itens.length
        ? await admin.from("protheus_notas_entrega").select("filial, pedido, zae_id").in("pedido", [...new Set(itens.map((i) => so(i.order)))]).returns<{ filial: string; pedido: string; zae_id: string }[]>()
        : { data: [] };
      const tem = new Set((jaTem ?? []).map((n) => `${n.filial}/${n.pedido}/${n.zae_id}`));
      await Promise.all(
        itens.map(async (i) => {
          if (tem.has(`${so(i.branch)}/${so(i.order)}/${so(i.id)}`)) {
            resumo.jaTinha++;
            return;
          }
          try {
            const n = await baixarNotaDaSaida(so(i.branch), so(i.order), so(i.id));
            if (n) doDia.notas++;
            else doDia.semNota++;
          } catch {
            doDia.falhas++;
          }
        })
      );
    }
    // Dia com falha fica sem marca: a próxima rodada tenta de novo (as notas
    // que já vieram são puladas pelo índice).
    if (doDia.falhas === 0) {
      const { error } = await admin
        .from("protheus_notas_copia")
        .upsert({ dia, entregas: doDia.entregas, notas: doDia.notas, sem_nota: doDia.semNota, falhas: 0, feito_em: new Date().toISOString() }, { onConflict: "dia" });
      if (error) throw new Error(error.message);
    }
    resumo.dias.push(dia);
    resumo.entregas += doDia.entregas;
    resumo.notas += doDia.notas;
    resumo.semNota += doDia.semNota;
    resumo.falhas += doDia.falhas;
  }
  return { ...resumo, parouPor: "fim" };
}
