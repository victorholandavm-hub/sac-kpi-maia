import { memoizeWithTtl } from "./memoCache";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { lerCarga, listarCargas, listarEmpresas, mensagemDeErro, progressoCarga } from "./odoo/logistica";
import type { CargaDetalhe, CargaOdoo, ParadaOdoo } from "./odoo/logisticaTipos";
import { fotosDaParadaOdoo, type FotoEntrega } from "./fotosEntregaOdoo";

// Consulta de carga pro SAC e a assistência -- Victor 26/10/2026 ("consultar
// o motorista, histórico e conferente de um pedido ou carga"). Só leitura da
// ponte: o romaneio (ROM/2026/00058) não é o id da carga (77), então a carga
// é achada na listagem -- primeiro a do CD (onde estão quase todas, < 1 s),
// depois a das lojas, 2 por vez. O Odoo não diz quem conferiu, só quando.

const DIAS = 120;

export type BuscaCarga = { ano: string | null; numero: number; prefixo?: "ROM" | "PROT" };

// "ROM/2026/00058", "rom 58", "carga 58", "carga ROM/2026/58" e as cargas
// que vieram do Protheus pro Odoo ("PROT/005595", "prot 5595"). Número solto
// fica para a consulta de pedido (é o número do pedido do Protheus).
export function numeroDaCarga(q: string): BuscaCarga | null {
  const t = q.trim();
  const rom = t.match(/^(?:carga\s*)?rom\s*[/\s-]?\s*(?:(\d{4})\s*[/\s-]\s*)?0*(\d{1,6})$/i);
  if (rom) return { ano: rom[1] ?? null, numero: Number(rom[2]), prefixo: "ROM" };
  const prot = t.match(/^(?:carga\s*)?prot\s*[/\s-]?\s*0*(\d{1,6})$/i);
  if (prot) return { ano: null, numero: Number(prot[1]), prefixo: "PROT" };
  const carga = t.match(/^carga\s*0*(\d{1,6})$/i);
  return carga ? { ano: null, numero: Number(carga[1]) } : null;
}

function casa(c: CargaOdoo, b: BuscaCarga): boolean {
  const m = c.romaneio.match(/^(ROM|PROT)\D*?(?:(\d{4})\D+)?0*(\d+)$/i);
  if (!m) return false;
  if (b.prefixo && m[1].toUpperCase() !== b.prefixo) return false;
  return Number(m[3]) === b.numero && (!b.ano || m[2] === b.ano);
}

const empresasCache = memoizeWithTtl(() => listarEmpresas("logistica"), 60 * 60_000);
const cargasDaEmpresa = memoizeWithTtl((companyId: number) => listarCargas(companyId, { dias: DIAS }), 2 * 60_000);

const maisRecente = (a: CargaOdoo, b: CargaOdoo) => (b.criada_em || "").localeCompare(a.criada_em || "") || b.carga_id - a.carga_id;

export async function acharCarga(b: BuscaCarga): Promise<CargaOdoo | null> {
  const empresas = await empresasCache();
  const cd = empresas.find((e) => /\bCD\b/.test(e.name));
  const ordem = cd ? [cd, ...empresas.filter((e) => e.id !== cd.id)] : empresas;
  const achadas: CargaOdoo[] = [];
  // CD sozinho primeiro; as lojas só se não achou.
  for (const lote of [ordem.slice(0, 1), ...Array.from({ length: Math.ceil((ordem.length - 1) / 2) }, (_, i) => ordem.slice(1 + i * 2, 3 + i * 2))]) {
    const listas = await Promise.all(lote.map((e) => cargasDaEmpresa(e.id).catch(() => [] as CargaOdoo[])));
    achadas.push(...listas.flat().filter((c) => casa(c, b)));
    if (achadas.length > 0) break;
  }
  return achadas.sort(maisRecente)[0] ?? null;
}

const cargaPorId = memoizeWithTtl((cargaId: number) => lerCarga(cargaId), 2 * 60_000);

// Fotos da baixa do pedido numa carga do Odoo (romaneio da tentativa) -- pra
// consulta de pedido mostrar no próprio cartão (Victor 26/10/2026).
export async function fotosDoPedidoNaCarga(romaneio: string, pedido: string): Promise<FotoEntrega[]> {
  const b = numeroDaCarga(romaneio);
  if (!b) return [];
  const achada = await acharCarga(b);
  if (!achada) return [];
  const carga = await cargaPorId(achada.carga_id);
  const parada = (carga.paradas ?? []).find((p) => (p.pickings ?? []).some((k) => k.pedido === pedido));
  return parada ? fotosDaParadaOdoo(carga.carga_id, parada.parada_id) : [];
}

// Carga inteira (eventos, paradas) pelo id ou pelo romaneio, pro histórico do pedido.
export async function cargaDoHistorico(ref: { cargaId?: number | null; romaneio?: string | null }): Promise<CargaDetalhe | null> {
  if (ref.cargaId) return cargaPorId(ref.cargaId);
  const b = ref.romaneio ? numeroDaCarga(ref.romaneio) : null;
  const achada = b ? await acharCarga(b) : null;
  return achada ? cargaPorId(achada.carga_id) : null;
}

export type ParadaComFotos = ParadaOdoo & { fotos: FotoEntrega[] };
// Quem fez cada passo no CD (odoo_carga_acoes, 0206, gravado pela tela de
// Logística): separacao, conferir, liberar, sair, finalizar.
export type AcaoCargaFeita = { acao: string; operador: string; em: string };
export type CargaConsulta = Omit<CargaDetalhe, "paradas"> & { paradas: ParadaComFotos[]; acoes: AcaoCargaFeita[] };
export type ResultadoCarga = { busca: string; carga: CargaConsulta | null; erro: string | null };

export async function consultarCarga(busca: string): Promise<ResultadoCarga> {
  const b = numeroDaCarga(busca);
  if (!b) return { busca, carga: null, erro: "Digite o romaneio da carga, ex.: ROM/2026/00058 ou carga 58." };
  try {
    const achada = await acharCarga(b);
    if (!achada) return { busca, carga: null, erro: null };
    const carga = await cargaPorId(achada.carga_id);
    const paradas = await Promise.all(
      (carga.paradas ?? []).map(async (p) => ({ ...p, fotos: await fotosDaParadaOdoo(carga.carga_id, p.parada_id).catch(() => []) }))
    );
    const { data: acoes } = await getSupabaseAdmin()
      .from("odoo_carga_acoes")
      .select("acao, operador, em")
      .eq("carga_id", carga.carga_id)
      .order("em")
      .returns<AcaoCargaFeita[]>();
    return {
      busca,
      carga: { ...carga, empresa: carga.empresa ?? achada.empresa, paradas, acoes: (acoes ?? []).map((a) => ({ ...a, operador: a.operador.replace(/^(CD|Equipe) /, "") })) },
      erro: null,
    };
  } catch (err) {
    return { busca, carga: null, erro: `O Odoo não respondeu agora (${mensagemDeErro(err)}). Tente de novo em instantes.` };
  }
}

// Andamento da emissão das notas de entrega da carga (aguardando / emitindo /
// ok / erro, com a resposta da SEFAZ). Cache de 1 min: a emissão anda rápido.
const progressoPorCarga = memoizeWithTtl((cargaId: number) => progressoCarga(cargaId), 60_000);

export async function notasDeEntregaDaCarga(cargaId: number): Promise<Map<string, { estado: string; nf: string | null; sefaz: string | null }>> {
  const r = await progressoPorCarga(cargaId);
  return new Map((r.itens ?? []).map((i) => [i.pedido, { estado: i.estado, nf: i.nf || null, sefaz: i.sefaz || null }]));
}
