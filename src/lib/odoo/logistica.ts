// Cliente server-side da ponte HTTP do Odoo (logística: expedição, cargas,
// paradas, romaneio, DANFE). Motor = Odoo (maia_entrega + maia_caixa);
// este sistema só desenha a tela e repassa os verbos do operador.
//
// SEGURANÇA: a chave da ponte (ODOO_KEY_LOGISTICA / ODOO_KEY_MOTORISTA) só
// existe no servidor. Este arquivo nunca pode ser importado por componente
// client -- a guarda abaixo derruba na hora se alguém tentar. A chave vai
// em header (X-Maia-Perfil / X-Maia-Key, aceitos pela ponte igual a ?p=&k=)
// pra não aparecer em URL/log de proxy.
//
// ERROS: nada silencioso. Toda falha (rede, timeout, HTTP != 2xx, ok:false
// do Odoo, corpo que não é JSON) vira OdooBridgeError com a rota e a
// mensagem que o Odoo devolveu -- quem chama decide o que mostrar.

import type {
  AcaoCarga,
  AcaoCargaExtra,
  AcaoCargaResposta,
  AcaoEntrega,
  CargaDetalhe,
  CargaOdoo,
  CatalogosOdoo,
  DanfeCarga,
  EmpresaOdoo,
  EntregaOdoo,
  EstadoCarga,
  ExpedicaoResposta,
  HistoricoEntrega,
  MontarCargaInput,
  RegistrarParadaInput,
  ResultadoParadaResposta,
  SolicitacaoAbast,
  AtenderAbastResposta,
} from "./logisticaTipos";

if (typeof window !== "undefined") {
  throw new Error("lib/odoo/logistica.ts é só de servidor (carrega a chave da ponte do Odoo).");
}

export type PerfilOdoo = "logistica" | "motorista";

const TIMEOUT_PADRAO_MS = 20_000;
// "sair em rota" emite uma NF-e 5117 por pedido (transmissão SEFAZ), pode
// levar bem mais que uma leitura.
const TIMEOUT_FATURAMENTO_MS = 120_000;

export class OdooBridgeError extends Error {
  constructor(
    message: string,
    readonly rota: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = "OdooBridgeError";
  }
}

function config(perfil: PerfilOdoo): { base: string; chave: string; timeoutMs: number } {
  const base = (process.env.ODOO_BRIDGE_URL ?? "").replace(/\/+$/, "");
  const chave = perfil === "logistica" ? process.env.ODOO_KEY_LOGISTICA : process.env.ODOO_KEY_MOTORISTA;
  if (!base) throw new OdooBridgeError("ODOO_BRIDGE_URL não configurada no servidor.", "(config)", null);
  if (!chave) {
    throw new OdooBridgeError(
      `Chave do perfil "${perfil}" não configurada (${perfil === "logistica" ? "ODOO_KEY_LOGISTICA" : "ODOO_KEY_MOTORISTA"}).`,
      "(config)",
      null,
    );
  }
  const t = Number(process.env.ODOO_BRIDGE_TIMEOUT_MS);
  return { base, chave, timeoutMs: Number.isFinite(t) && t > 0 ? t : TIMEOUT_PADRAO_MS };
}

type Opcoes = {
  perfil: PerfilOdoo;
  metodo?: "GET" | "POST";
  corpo?: unknown;
  query?: Record<string, string | number | undefined | null>;
  timeoutMs?: number;
};

async function chamar(rota: string, op: Opcoes): Promise<Response> {
  const cfg = config(op.perfil);
  const url = new URL(cfg.base + rota);
  for (const [k, v] of Object.entries(op.query ?? {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  const timeoutMs = op.timeoutMs ?? cfg.timeoutMs;
  try {
    return await fetch(url, {
      method: op.metodo ?? "GET",
      headers: {
        "X-Maia-Perfil": op.perfil,
        "X-Maia-Key": cfg.chave,
        Accept: "application/json, application/pdf",
        ...(op.corpo !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: op.corpo !== undefined ? JSON.stringify(op.corpo) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const e = err as Error;
    if (e?.name === "TimeoutError" || e?.name === "AbortError") {
      throw new OdooBridgeError(`Odoo não respondeu em ${Math.round(timeoutMs / 1000)} s (${rota}).`, rota, null);
    }
    throw new OdooBridgeError(`Sem conexão com a ponte do Odoo (${rota}): ${e?.message ?? "erro de rede"}.`, rota, null);
  }
}

async function json<T>(rota: string, op: Opcoes): Promise<T> {
  const res = await chamar(rota, op);
  const bruto = await res.text();
  let dados: { ok?: boolean; erro?: string } & Record<string, unknown>;
  try {
    dados = bruto ? JSON.parse(bruto) : {};
  } catch {
    throw new OdooBridgeError(`Resposta inválida da ponte (HTTP ${res.status}, ${rota}): ${bruto.slice(0, 200)}`, rota, res.status);
  }
  if (res.status === 401) throw new OdooBridgeError("Ponte do Odoo recusou a chave (401). Conferir ODOO_KEY_*.", rota, 401);
  if (!res.ok || dados.ok === false) {
    throw new OdooBridgeError(dados.erro || `Erro HTTP ${res.status} em ${rota}.`, rota, res.status);
  }
  return dados as T;
}

async function pdf(rota: string, op: Opcoes): Promise<{ bytes: ArrayBuffer; nome: string }> {
  const res = await chamar(rota, op);
  const tipo = res.headers.get("content-type") ?? "";
  if (!res.ok || !tipo.includes("application/pdf")) {
    const bruto = await res.text();
    let erro = bruto.slice(0, 300);
    try {
      erro = (JSON.parse(bruto) as { erro?: string }).erro ?? erro;
    } catch {
      // corpo não-JSON: mostra o começo do texto como veio
    }
    throw new OdooBridgeError(`PDF indisponível (HTTP ${res.status}): ${erro}`, rota, res.status);
  }
  const disp = res.headers.get("content-disposition") ?? "";
  const nome = /filename="?([^";]+)"?/.exec(disp)?.[1] ?? "documento.pdf";
  return { bytes: await res.arrayBuffer(), nome };
}

// ---------------------------------------------------------------- leitura

export function listarEmpresas(perfil: PerfilOdoo = "logistica"): Promise<EmpresaOdoo[]> {
  // /empresas devolve a lista crua (sem {ok}); json() aceita.
  return json<EmpresaOdoo[]>("/empresas", { perfil });
}

export function lerExpedicao(companyId: number, dias = 90): Promise<ExpedicaoResposta> {
  return json<ExpedicaoResposta>("/logistica/expedicao", { perfil: "logistica", query: { company_id: companyId, dias } });
}

export async function listarCargas(
  companyId: number,
  opts: { estados?: EstadoCarga[]; dias?: number; perfil?: PerfilOdoo } = {},
): Promise<CargaOdoo[]> {
  const r = await json<{ cargas: CargaOdoo[] }>("/logistica/cargas", {
    perfil: opts.perfil ?? "logistica",
    query: { company_id: companyId, estados: opts.estados?.join(","), dias: opts.dias ?? 30 },
  });
  return r.cargas ?? [];
}

export async function lerCatalogos(companyId: number, perfil: PerfilOdoo = "logistica"): Promise<CatalogosOdoo> {
  return json<CatalogosOdoo>("/logistica/catalogos", { perfil, query: { company_id: companyId } });
}

export function lerCarga(cargaId: number, perfil: PerfilOdoo = "logistica"): Promise<CargaDetalhe> {
  return json<CargaDetalhe>(`/logistica/carga/${int(cargaId)}`, { perfil });
}

// ---------------------------------------------------------------- carga (CD)

export function montarCarga(input: MontarCargaInput): Promise<CargaDetalhe> {
  if (!input.picking_ids.length) throw new OdooBridgeError("Selecione ao menos uma saída.", "/logistica/carga", null);
  return json<CargaDetalhe>("/logistica/carga", { perfil: "logistica", metodo: "POST", corpo: input });
}

export function executarAcaoCarga(
  cargaId: number,
  acao: AcaoCarga,
  opts: {
    operador: string;
    motorista_id?: number | null;
    veiculo_id?: number | null;
    ajudante_ids?: number[] | null;
    parciais?: Record<string, { codigo: string; qtd: number }[]> | null;
    perfil?: PerfilOdoo;
  },
): Promise<AcaoCargaResposta> {
  const { perfil, ...corpo } = opts;
  return json<AcaoCargaResposta>(`/logistica/carga/${int(cargaId)}/${acao}`, {
    perfil: perfil ?? "logistica",
    metodo: "POST",
    corpo,
    timeoutMs: acao === "sair" ? TIMEOUT_FATURAMENTO_MS : undefined,
  });
}

export function reordenarParadas(cargaId: number, paradaIds: number[]): Promise<CargaDetalhe> {
  return json<CargaDetalhe>(`/logistica/carga/${int(cargaId)}/reordenar`, {
    perfil: "logistica",
    metodo: "POST",
    corpo: { parada_ids: paradaIds.map(int) },
  });
}

type ExtraSemArquivo = Exclude<AcaoCargaExtra, "romaneio" | "danfes">;

export function acaoExtraCarga(
  cargaId: number,
  acao: ExtraSemArquivo,
  valor: string | number | number[] | null,
  operador: string,
): Promise<CargaDetalhe | { carga: string; excluida: true; entregas_liberadas: number }> {
  return json(`/logistica/carga/${int(cargaId)}/extra/${acao}`, { perfil: "logistica", metodo: "POST", corpo: { valor, operador } });
}

export async function listarDanfesCarga(cargaId: number): Promise<DanfeCarga[]> {
  const r = await json<{ notas: DanfeCarga[] }>(`/logistica/carga/${int(cargaId)}/extra/danfes`, {
    perfil: "logistica",
    metodo: "POST",
    corpo: {},
  });
  return r.notas ?? [];
}

export function baixarRomaneioPdf(cargaId: number, operador: string): Promise<{ bytes: ArrayBuffer; nome: string }> {
  return pdf(`/logistica/carga/${int(cargaId)}/extra/romaneio`, {
    perfil: "logistica",
    metodo: "POST",
    corpo: { operador },
    timeoutMs: 60_000,
  });
}

// 26/10 (Eduardo, CD): DANFE da NF 5152 do abastecimento, que não tem pedido de venda -> pela chave
export function baixarDanfeChavePdf(chave: string, perfil: PerfilOdoo = "logistica") {
  const c = String(chave).replace(/\D/g, "");
  if (c.length !== 44) throw new Error("Chave da nota inválida.");
  return pdf(`/nota/${c}/danfe.pdf`, { perfil, timeoutMs: 60_000 });
}

export function baixarDanfePdf(pedidoId: number, doc: "5117" | "5922" = "5117", perfil: PerfilOdoo = "logistica") {
  return pdf(`/pedido/${int(pedidoId)}/danfe.pdf`, { perfil, query: { doc }, timeoutMs: 60_000 });
}

// ---------------------------------------------------------------- entrega (pedido)

export function acaoEntrega(
  pickingId: number,
  acao: Exclude<AcaoEntrega, "historico" | "estornar">,
  valor: string | number | null,
  operador: string,
): Promise<EntregaOdoo> {
  return json<EntregaOdoo>(`/logistica/entrega/${int(pickingId)}/${acao}`, { perfil: "logistica", metodo: "POST", corpo: { valor, operador } });
}

export function estornarEntrega(pickingId: number, operador: string): Promise<{ estornada: string; retorno: string; nova: string }> {
  return json(`/logistica/entrega/${int(pickingId)}/estornar`, { perfil: "logistica", metodo: "POST", corpo: { operador }, timeoutMs: 60_000 });
}

export function historicoEntrega(pickingId: number, operador: string): Promise<HistoricoEntrega> {
  return json<HistoricoEntrega>(`/logistica/entrega/${int(pickingId)}/historico`, { perfil: "logistica", metodo: "POST", corpo: { operador } });
}

// ---------------------------------------------------------------- motorista

export function registrarResultadoParada(paradaId: number, input: RegistrarParadaInput): Promise<ResultadoParadaResposta> {
  if (input.resultado === "insucesso" && !input.motivo) {
    throw new OdooBridgeError("Informe o motivo do insucesso.", `/logistica/parada/${paradaId}`, null);
  }
  return json<ResultadoParadaResposta>(`/logistica/parada/${int(paradaId)}`, {
    perfil: "motorista",
    metodo: "POST",
    corpo: { origem: "app", ...input },
  });
}

function int(v: number): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new OdooBridgeError(`Identificador inválido: ${v}`, "(validação)", null);
  return n;
}

export function mensagemDeErro(err: unknown): string {
  if (err instanceof OdooBridgeError) return err.message;
  if (err instanceof Error) return err.message;
  return "Erro inesperado ao falar com o Odoo.";
}

// ---- Pedidos de abastecimento das lojas (25/10/2026) --------------------
export async function listarSolicitacoesAbast(dias = 60): Promise<SolicitacaoAbast[]> {
  const r = await json<{ solicitacoes: SolicitacaoAbast[] }>("/abastecimento", {
    perfil: "logistica",
    query: { estado: "aberta", dias },
  });
  return r.solicitacoes ?? [];
}

export async function atenderSolicitacaoAbast(
  id: number,
  itens: { codigo: string; qtd: number }[],
  operador: string,
): Promise<AtenderAbastResposta> {
  // emite a NF-e 5152 (transmissão SEFAZ) -> mesmo prazo do "sair em rota"
  return json<AtenderAbastResposta>(`/abastecimento/${id}/atender`, {
    perfil: "logistica",
    metodo: "POST",
    corpo: { itens, operador },
    timeoutMs: TIMEOUT_FATURAMENTO_MS,
  });
}

export async function cancelarSolicitacaoAbast(id: number, operador: string, motivo: string): Promise<unknown> {
  return json(`/abastecimento/${id}/cancelar`, { perfil: "logistica", metodo: "POST", corpo: { operador, motivo } });
}

// ---- Kardex (25/10/2026, Rafael/CD) -------------------------------------
export type MovimentoKardex = {
  data: string; documento: string; origem: string; de: string; para: string; parceiro: string;
  entrada: number; saida: number; saldo_apos: number;
};
export type KardexResposta = {
  codigo: string; produto: string; company_id: number; saldo: number; reservado: number; disponivel: number;
  saldo_inicial_periodo: number; movimentos: MovimentoKardex[];
};
export async function lerKardex(codigo: string, companyId: number, dias = 90): Promise<KardexResposta> {
  return json<KardexResposta>("/estoque/kardex", { perfil: "logistica", query: { codigo, company_id: companyId, dias } });
}

// ---- Compras do CD (25/10/2026, Rafael) ---------------------------------
// Pedido de compra no Odoo = fonte da pré-venda (previsão de chegada) do
// coach e do site. A previsão só baixa quando o CD dá ENTRADA da nota
// contra o pedido (recebimento validado) -- por isso a entrada é feita aqui.
export type ItemCompra = {
  linha_id: number; codigo: string; nome: string; qtd: number; recebido: number; falta: number;
  preco: number; previsao: string; vencida: boolean;
};
export type PedidoCompra = {
  id: number; numero: string; fornecedor: string; fornecedor_id: number; cnpj: string; ref: string; origem: string;
  estado: string; recebimento: string; previsao: string; vencida: boolean; total: number; criado: string; obs: string;
  itens: ItemCompra[]; pendentes: number;
  recebimentos: { id: number; numero: string; estado: string; concluido: string }[];
};
export type FornecedorOdoo = { id: number; nome: string; cnpj: string; cidade: string; ja_fornece: boolean };
export type EntradaCompraResposta = { recebimento: string; nota: string; pendente: string[]; pedido: PedidoCompra | null };

export async function listarPedidosCompra(estado: "abertos" | "todos" = "abertos", q = ""): Promise<{ hoje: string; pedidos: PedidoCompra[] }> {
  const r = await json<{ hoje: string; pedidos: PedidoCompra[] }>("/compras/pedidos", { perfil: "logistica", query: { estado, q } });
  return { hoje: r.hoje, pedidos: r.pedidos ?? [] };
}
export async function buscarFornecedores(q: string): Promise<FornecedorOdoo[]> {
  const r = await json<{ fornecedores: FornecedorOdoo[] }>("/compras/fornecedores", { perfil: "logistica", query: { q } });
  return r.fornecedores ?? [];
}
export async function criarPedidoCompra(input: {
  fornecedor_id: number; ref: string; obs: string; itens: { codigo: string; qtd: number; preco: number; previsao: string }[];
}, operador: string): Promise<{ pedido: PedidoCompra }> {
  return json("/compras/pedido", { perfil: "logistica", metodo: "POST", corpo: { ...input, operador }, timeoutMs: 60_000 });
}
export async function mudarPrevisaoCompra(id: number, data: string, operador: string): Promise<{ pedido: PedidoCompra }> {
  return json(`/compras/pedido/${id}/previsao`, { perfil: "logistica", metodo: "POST", corpo: { data, operador } });
}
export async function cancelarPedidoCompra(id: number, motivo: string, operador: string): Promise<unknown> {
  return json(`/compras/pedido/${id}/cancelar`, { perfil: "logistica", metodo: "POST", corpo: { motivo, operador } });
}
export async function darEntradaCompra(recebimentoId: number, input: {
  nf: string; serie: string; chave: string; itens: { codigo: string; qtd: number }[];
}, operador: string): Promise<EntradaCompraResposta> {
  return json(`/compras/receber/${recebimentoId}`, { perfil: "logistica", metodo: "POST", corpo: { ...input, operador }, timeoutMs: 60_000 });
}

// ---- Inventário / contagem (25/10/2026 noite, Pedro) --------------------
export type ItemInventarioSaldo = { codigo: string; existe: boolean; nome?: string; estocavel?: boolean; sistema?: number; reservado?: number };
export type ItemInventarioAjuste = { codigo: string; nome: string; antes: number; depois: number; ajuste: number };
export async function inventarioSaldo(companyId: number, codigos: string[]): Promise<{ empresa: string; deposito: string; itens: ItemInventarioSaldo[] }> {
  return json("/inventario/saldo", { perfil: "logistica", metodo: "POST", corpo: { company_id: companyId, codigos } });
}
export async function inventarioAplicar(companyId: number, itens: { codigo: string; contado: number }[], operador: string, motivo: string):
  Promise<{ itens: ItemInventarioAjuste[]; erros: string[]; ajustados: number }> {
  return json("/inventario/aplicar", { perfil: "logistica", metodo: "POST", corpo: { company_id: companyId, itens, operador, motivo }, timeoutMs: 120_000 });
}

// 26/10 (Pedro, igual ao uMov "A caminho da entrega"): motorista registra que chegou no cliente (GPS + hora)
export function registrarChegadaParada(paradaId: number, geo_lat: number | null, geo_lng: number | null, motorista_id: number | null): Promise<{ ok: true; parada_id: number; ja_registrada?: boolean; em?: string }> {
  return json(`/logistica/parada/${int(paradaId)}/chegada`, { perfil: "motorista", metodo: "POST", corpo: { geo_lat, geo_lng, motorista_id, origem: "app" } });
}
