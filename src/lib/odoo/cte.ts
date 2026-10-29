// 29/10/2026 (Pedro → Eduardo/CD): Fretes (CT-e) das compras. Ponte /compras/cte lê o que o robô fiscal já baixou
// (CT-e da SEFAZ + rateio do frete por nota/item) e diz se a NF-e já deu entrada. Não mexe em custo.
// Arquivo próprio (não dentro de logistica.ts) de propósito: mesmo cliente HTTP da ponte, só de servidor.
import { OdooBridgeError } from "./logistica";

if (typeof window !== "undefined") {
  throw new Error("lib/odoo/cte.ts é só de servidor (carrega a chave da ponte do Odoo).");
}

export type CteSituacao = "sem_nfe" | "faltam_nfe" | "aguardando_rateio" | "rateado" | "tomador_terceiro" | "cancelado";
export type CteItemRateio = { n_item: number; codigo: string; descricao: string; qtd: number; valor: number; frete_cte: number; custo_unit_com_frete: number; custo_unit_final: number };
export type CteNfe = {
  chave: string; numero: string; cnpj_fornecedor: string; fornecedor: string; valor: number; emissao: string; no_cmv: boolean; no_odoo: boolean;
  odoo_numero: string; odoo_estado: string; odoo_empresa: string; frete_rateado: number; vinculo: "xml" | "manual"; vinculado_por: string; itens?: CteItemRateio[];
};
export type CteFrete = {
  chave: string; numero: string; serie: string; emissao: string; transportadora: { nome: string; cnpj: string }; remetente: { nome: string; cnpj: string };
  tomador: { codigo: string; descricao: string; aiam: boolean; cnpj: string }; cnpj_aiam: string; valor_frete: number; modal: string; modal_texto: string;
  tp_serv: string; tp_serv_texto: string; origem: string; destino: string; cancelado: boolean; sem_xml: boolean; situacao: CteSituacao; situacao_texto: string;
  nfes: CteNfe[]; qtd_nfe: number; frete_rateado_total: number; arquivo: string;
};
export type CteLista = {
  desde: string; dias: number; q: string; total: number; totais: Record<CteSituacao, number>; valor_por_situacao: Record<CteSituacao, number>;
  situacoes: { codigo: CteSituacao; texto: string }[]; ctes: CteFrete[]; limitado: boolean; atualizado: string;
};
export type VinculoCteResposta = { vinculadas: string[]; ja_existiam: string[]; cte: CteFrete | null; mensagem: string };
export type XmlCteResposta = { chave: string; ja_existia: boolean; arquivo: string; cte: CteFrete | null; mensagem: string };

type Opcoes = { metodo?: "GET" | "POST"; corpo?: unknown; query?: Record<string, string | number | undefined | null>; timeoutMs?: number };

async function json<T>(rota: string, op: Opcoes = {}): Promise<T> {
  const base = (process.env.ODOO_BRIDGE_URL ?? "").replace(/\/+$/, "");
  const chave = process.env.ODOO_KEY_LOGISTICA;
  if (!base) throw new OdooBridgeError("ODOO_BRIDGE_URL não configurada no servidor.", "(config)", null);
  if (!chave) throw new OdooBridgeError("Chave do perfil \"logistica\" não configurada (ODOO_KEY_LOGISTICA).", "(config)", null);
  const url = new URL(base + rota);
  for (const [k, v] of Object.entries(op.query ?? {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  const timeoutMs = op.timeoutMs ?? 60_000;
  let res: Response;
  try {
    res = await fetch(url, {
      method: op.metodo ?? "GET",
      headers: { "X-Maia-Perfil": "logistica", "X-Maia-Key": chave, Accept: "application/json", ...(op.corpo !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: op.corpo !== undefined ? JSON.stringify(op.corpo) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const e = err as Error;
    if (e?.name === "TimeoutError" || e?.name === "AbortError") throw new OdooBridgeError(`A ponte não respondeu em ${Math.round(timeoutMs / 1000)} s (${rota}).`, rota, null);
    throw new OdooBridgeError(`Sem conexão com a ponte (${rota}): ${e?.message ?? "erro de rede"}.`, rota, null);
  }
  const bruto = await res.text();
  let dados: { ok?: boolean; erro?: string } & Record<string, unknown>;
  try {
    dados = bruto ? JSON.parse(bruto) : {};
  } catch {
    throw new OdooBridgeError(`Resposta inválida da ponte (HTTP ${res.status}, ${rota}): ${bruto.slice(0, 200)}`, rota, res.status);
  }
  if (res.status === 401) throw new OdooBridgeError("Ponte recusou a chave (401). Conferir ODOO_KEY_LOGISTICA.", rota, 401);
  if (!res.ok || dados.ok === false) throw new OdooBridgeError(dados.erro || `Erro HTTP ${res.status} em ${rota}.`, rota, res.status);
  return dados as T;
}

export function listarCtes(dias = 60, q = "", situacao = ""): Promise<CteLista> {
  return json<CteLista>("/compras/cte", { query: { dias, q, situacao }, timeoutMs: 90_000 });
}
export async function lerCte(chave: string): Promise<CteFrete> {
  const r = await json<{ cte: CteFrete }>(`/compras/cte/${chave.replace(/\D/g, "")}`);
  return r.cte;
}
export function vincularNfeCte(chave: string, nfeChaves: string[], operador: string): Promise<VinculoCteResposta> {
  return json<VinculoCteResposta>(`/compras/cte/${chave.replace(/\D/g, "")}/vincular`, { metodo: "POST", corpo: { nfe_chaves: nfeChaves, operador } });
}
export function subirXmlCte(xml: string, nome: string, operador: string): Promise<XmlCteResposta> {
  return json<XmlCteResposta>("/compras/cte/xml", { metodo: "POST", corpo: { xml, nome, operador }, timeoutMs: 90_000 });
}
