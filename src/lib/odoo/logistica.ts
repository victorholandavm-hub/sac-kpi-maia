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
// 26/10: carga de 16 notas levou 202 s; a tela segue acompanhando pelo progresso se a resposta não vier a tempo
const TIMEOUT_FATURAMENTO_MS = 290_000;

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

const EMPRESA_CD = 13;
// 26/10 (Jhon): motoristas e veículos estão cadastrados só no CD; carga de loja abria sem motorista para escolher
export async function lerCatalogosComMotoristas(companyId: number, perfil: PerfilOdoo = "logistica"): Promise<CatalogosOdoo> {
  const c = await lerCatalogos(companyId, perfil);
  if (c.motoristas?.length || companyId === EMPRESA_CD) return c;
  const cd = await lerCatalogos(EMPRESA_CD, perfil);
  return { ...c, motoristas: cd.motoristas, veiculos: cd.veiculos };
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
// 26/10 (Pedro): "Abrir todas" abria só 1 (navegador bloqueia várias janelas) -> PDF único da carga
export function baixarDanfesCargaPdf(cargaId: number, perfil: PerfilOdoo = "logistica") {
  return pdf(`/logistica/carga/${int(cargaId)}/danfes.pdf`, { perfil, timeoutMs: 180_000 });
}

export type BuscaEntrega = { pedido: string; pedido_id: number; picking: string; picking_id: number; cliente: string; loja: string; modo: string;
  nf5922: string; nf5117: string; nota: string; situacao: string; cor: "ok" | "info" | "alerta"; carga_id: number | false; na_fila: boolean };
// 26/10 (Pedro): a busca da Expedição acha o pedido onde estiver (carga, rota, entregue, pendência, loja/reserva)
export async function buscarEntregas(q: string): Promise<BuscaEntrega[]> {
  const r = await json<{ itens: BuscaEntrega[] }>("/logistica/busca", { perfil: "logistica", query: { q } });
  return r.itens ?? [];
}

export type TransferenciaEmitida = { numero: string; serie: string; data: string; loja: string; valor: number; estado: string; chave: string };
// 26/10 (Eduardo): notas 5152 já emitidas (o pedido atendido sai da lista; a nota tem que continuar à mão)
export async function listarTransferencias(dias = 7): Promise<TransferenciaEmitida[]> {
  const r = await json<{ notas: TransferenciaEmitida[] }>("/logistica/transferencias", { perfil: "logistica", query: { dias } });
  return r.notas ?? [];
}

export function baixarDanfeChavePdf(chave: string, perfil: PerfilOdoo = "logistica") {
  const c = String(chave).replace(/\D/g, "");
  if (c.length !== 44) throw new Error("Chave da nota inválida.");
  return pdf(`/nota/${c}/danfe.pdf`, { perfil, timeoutMs: 60_000 });
}

export function baixarDanfePdf(pedidoId: number, doc: "5117" | "5922" = "5117", perfil: PerfilOdoo = "logistica") {
  return pdf(`/pedido/${int(pedidoId)}/danfe.pdf`, { perfil, query: { doc }, timeoutMs: 60_000 });
}

// ---------------------------------------------------------------- entrega (pedido)

// 26/10 (Pedro/Jhon): pendência por item -- escolhe o que espera; o resto segue
export type ItemEntregaOdoo = { move_id: number; codigo: string; nome: string; qtd: number; tem_estoque: boolean };
export async function lerItensEntrega(pickingId: number): Promise<ItemEntregaOdoo[]> {
  const r = await json<{ itens: ItemEntregaOdoo[] }>(`/logistica/entrega/${int(pickingId)}/itens`, { perfil: "logistica" });
  return r.itens ?? [];
}
export function separarPendencia(pickingId: number, motivo: string, codigos: string[], operador: string): Promise<{ pendencia: string; itens: string }> {
  return json<{ pendencia: string; itens: string }>(`/logistica/entrega/${int(pickingId)}/separar_pendencia`, { perfil: "logistica", metodo: "POST", corpo: { valor: { motivo, codigos }, operador } });
}

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

// 26/10: baixa feita pelo CD (retirada no balcão do CD), sem o app do motorista
export function registrarParadaPeloCd(paradaId: number, input: RegistrarParadaInput): Promise<ResultadoParadaResposta> {
  return json<ResultadoParadaResposta>(`/logistica/parada/${int(paradaId)}`, { perfil: "logistica", metodo: "POST", corpo: { origem: "odoo", ...input } });
}

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

// 26/10 (Pedro/Eduardo): o CD inclui o pedido para QUALQUER loja e pode já faturar (5152)
export async function novoPedidoAbast(input: { company_id_loja: number; itens: { codigo: string; qtd: number }[]; atender: boolean; obs?: string }, operador: string): Promise<AtenderAbastResposta & { solicitacao?: { id: number; nome: string; loja: string } }> {
  return json("/abastecimento/novo", { perfil: "logistica", metodo: "POST", corpo: { ...input, operador }, timeoutMs: TIMEOUT_FATURAMENTO_MS });
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
export type EntradaCompraResposta = { recebimento: string; nota: string; pendente: string[]; pedido: PedidoCompra | null;
  pagar?: { conta: string; estado: string; total: number; parcelas: { venc: string; valor: number }[] } | null;
  aviso_pagar?: string | null;
};

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
// 26/10 (Pedro: "não é para usar o Odoo"): cadastro de produto e preço (tabela 087) pela aba Produtos
// 26/10 (Pedro/Eduardo): entrada de nota de fornecedor SEM pedido de compra no CD (ponte /entrada/cd/*, empresa fixa 213)
export type ItemNfFornecedor = { cprod: string; ean: string; nome: string; un: string; qtd: number; preco: number;
  produto: { id: number; codigo: string; nome: string } | null; casado_por?: string };
export type NfFornecedor = { achou: boolean; chave: string; numero: string; serie: string; emissao?: string; total?: number;
  fornecedor?: { id: number | false; cnpj: string; nome: string; novo: boolean }; itens?: ItemNfFornecedor[]; parcelas?: ParcelaPagar[];
  sem_produto?: number; aviso?: string };
export type EntradaSemPedidoResposta = { pedido: string; msg: string;
  pagar?: { conta: string; estado: string; total: number; parcelas: { venc: string; valor: number }[] } | null; aviso_pagar?: string | null };
export function lerNfCdPorChave(chave: string): Promise<NfFornecedor> {
  return json<NfFornecedor>("/entrada/cd/nf", { perfil: "logistica", query: { chave } });
}
export function lerNfCdPorXml(xml: string): Promise<NfFornecedor> {
  return json<NfFornecedor>("/entrada/cd/nf/xml", { perfil: "logistica", metodo: "POST", corpo: { xml } });
}
export function darEntradaSemPedidoCd(input: {
  chave: string; nf: string; serie: string; emissao: string; fornecedor: { id: number | false; cnpj: string; nome: string };
  itens: { product_id?: number; codigo?: string; qtd: number; preco: number; cprod: string; nome: string }[];
  lancar_pagar: boolean; parcelas: ParcelaPagar[];
}, operador: string): Promise<EntradaSemPedidoResposta> {
  return json<EntradaSemPedidoResposta>("/entrada/cd/fornecedor", { perfil: "logistica", metodo: "POST", corpo: { ...input, operador }, timeoutMs: 120_000 });
}

export type ProdutoCadastro = { id: number; codigo: string; nome: string; preco: number; custo: number; ncm: string; ean: string;
  ativo: boolean; vende: boolean; estocavel: boolean; estoque_cd: number; alterado: string; reservado_cd?: number; disponivel_cd?: number };
export type EstoqueLoja = { loja: string; saldo: number; reservado: number; disponivel: number };
// 26/10 (Pedro/Flávio): lupa com o estoque do produto em cada loja
export async function lojasProdutoCadastro(id: number): Promise<{ lojas: EstoqueLoja[]; total: number }> {
  return json<{ lojas: EstoqueLoja[]; total: number }>(`/produtos/cadastro/${int(id)}/lojas`, { perfil: "logistica" });
}
export async function buscarProdutosCadastro(q: string): Promise<ProdutoCadastro[]> {
  const r = await json<{ itens: ProdutoCadastro[] }>("/produtos/cadastro", { perfil: "logistica", query: { q } });
  return r.itens ?? [];
}
export function criarProdutoCadastro(input: { codigo: string; nome: string; preco: number; ncm: string; ean?: string; custo?: number }, operador: string): Promise<{ produto: ProdutoCadastro }> {
  return json("/produtos/cadastro", { perfil: "logistica", metodo: "POST", corpo: { ...input, operador } });
}
export function alterarProdutoCadastro(id: number, input: { preco?: number; nome?: string; ncm?: string; ean?: string; ativo?: boolean }, operador: string): Promise<{ produto: ProdutoCadastro; mudou?: string[]; aviso?: string }> {
  return json(`/produtos/cadastro/${int(id)}`, { perfil: "logistica", metodo: "POST", corpo: { ...input, operador } });
}

export type ParcelaPagar = { venc: string; valor: number; n?: string };
export type NfChave = { achou: boolean; chave: string; numero: string; serie: string; emissao?: string; fornecedor?: string; cnpj?: string;
  total?: number; parcelas?: ParcelaPagar[]; itens?: { nome: string; qtd: number; preco: number; codigo: string }[]; aviso?: string };
// 26/10 (Pedro/Eduardo): colou a chave -> dados da nota e os boletos (duplicatas do XML recebido da SEFAZ)
export function buscarNfChave(chave: string): Promise<NfChave> {
  return json<NfChave>("/compras/nf-chave", { perfil: "logistica", query: { chave } });
}

export async function darEntradaCompra(recebimentoId: number, input: {
  nf: string; serie: string; chave: string; itens: { codigo: string; qtd: number }[];
  lancar_pagar?: boolean; emissao?: string; parcelas?: ParcelaPagar[];
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


// ---- Manifesto (MDF-e) das cargas (26/10/2026, Pedro) -------------------
export type NotaCarga = { tipo: "5152" | "5922" | "5117"; titulo: string; numero: string; serie: string; chave: string; pedido: string; cliente: string; legado?: boolean };
export type MdfeCarga = { numero: string; serie: string; chave: string; estado: string } | null;
export type CargaManifesto = {
  carga_id: number; romaneio: string; tipo: string; estado: string; motorista: string; veiculo: string;
  notas: NotaCarga[] | null; mdfe: MdfeCarga; faltas: string[]; criada_em?: string;
};
export async function listarManifesto(companyId: number, dias = 7): Promise<CargaManifesto[]> {
  const r = await json<{ cargas: CargaManifesto[] }>("/logistica/manifesto", { perfil: "logistica", query: { company_id: companyId, dias }, timeoutMs: 120_000 });
  return r.cargas ?? [];
}
export function notasDaCarga(cargaId: number): Promise<{ romaneio: string; notas: NotaCarga[]; mdfe: MdfeCarga; faltas: string[] }> {
  return json(`/logistica/carga/${int(cargaId)}/notas`, { perfil: "logistica", timeoutMs: 120_000 });
}
// 26/10 (Pedro: "a gente não sabe qual nota está faturando"): andamento da emissão das notas da carga
export type ProgressoItem = { pedido: string; cliente: string; estado: "aguardando" | "emitindo" | "ok" | "erro" | string; nf: string; sefaz: string };
export type ProgressoCarga = { carga: string; estado: string; total: number; feitos: number; erros: number; itens: ProgressoItem[] };
// 26/10 (Victor): saída do CD para o estoque da assistência (local 213 C/AT, fora do estoque de venda) -- ponte /inventario/transferir
export type TransferenciaAt = { ok: boolean; picking: string; estado: string; qtd: number; msg: string };
export function transferirCdAt(input: { codigo: string; qtd: number; motivo: string }, operador: string): Promise<TransferenciaAt> {
  return json<TransferenciaAt>("/inventario/transferir", {
    perfil: "logistica", metodo: "POST", corpo: { ...input, origem: "CD", destino: "AT", operador }, timeoutMs: 60_000,
  });
}

export function progressoCarga(cargaId: number): Promise<ProgressoCarga> {
  return json<ProgressoCarga>(`/logistica/carga/${int(cargaId)}/progresso`, { perfil: "logistica", timeoutMs: 15_000 });
}
export function acaoMdfe(cargaId: number, acao: "emitir" | "encerrar" | "consultar", operador: string): Promise<Record<string, unknown>> {
  return json(`/logistica/carga/${int(cargaId)}/mdfe/${acao}`, { perfil: "logistica", metodo: "POST", corpo: { operador }, timeoutMs: 180_000 });
}
export function baixarDamdfePdf(cargaId: number): Promise<{ bytes: ArrayBuffer; nome: string }> {
  return pdf(`/logistica/carga/${int(cargaId)}/mdfe/damdfe`, { perfil: "logistica", metodo: "POST", corpo: {}, timeoutMs: 120_000 });
}

// ---- 26/10 (Pedro via Antônio Costa: rotinas da auditoria — Flávio): aba Estoque. Só leitura no Odoo.
export type AudPosicaoItem = {
  product_id: number; codigo: string; produto: string; ean: string; categoria: string; categ_id: number;
  company_id: number; loja: string; fisico: number; reservado: number; disponivel: number; custo_medio: number; valor: number;
};
export type AudReservaItem = {
  codigo: string; produto: string; qtd: number; loja: string; company_id: number; documento: string; pedido: string;
  origem: string; cliente: string; tipo: string; desde: string; dias: number; previsto: string;
};
export type AudSefazItem = {
  id: number; chave: string; numero: string; serie: string; emitente: string; cnpj: string; transferencia: boolean; valor: number;
  emissao: string; company_id: number | null; loja: string; manifestacao: string; xml: boolean; entrada: boolean;
};
export type AudPedidoItem = {
  pedido_id: number; pedido: string; cliente: string; valor: number; data: string; dias: number; vendedor: string; loja: string;
  company_id: number; retira_em: string; estado: string; tipo: string; situacao: string; pago: boolean; pago_caixa: boolean;
  pagto_vendedor: string; nf5922: string; reservado: number; saidas: string[]; pode_excluir: boolean; motivo_bloqueio: string;
};
export type AudLista<T> = { totais: Record<string, number>; total: number; itens: T[]; ms?: number };
export type AudFiltro = { company_id?: number; q?: string; categoria?: number; negativo?: boolean; dias?: number; situacao?: string; limit?: number; offset?: number; formato?: "csv" };

function audQuery(f: AudFiltro): Record<string, string | number | undefined> {
  return {
    company_id: f.company_id ?? 0, q: f.q || undefined, categoria: f.categoria || undefined, negativo: f.negativo ? 1 : undefined,
    dias: f.dias, situacao: f.situacao, limit: f.limit, offset: f.offset, formato: f.formato,
  };
}
export function audPosicao(f: AudFiltro): Promise<AudLista<AudPosicaoItem>> {
  return json("/auditoria/posicao", { perfil: "logistica", query: audQuery(f), timeoutMs: 60_000 });
}
export function audReservas(f: AudFiltro): Promise<AudLista<AudReservaItem>> {
  return json("/auditoria/reservas", { perfil: "logistica", query: audQuery(f), timeoutMs: 60_000 });
}
export function audSefaz(f: AudFiltro): Promise<AudLista<AudSefazItem>> {
  return json("/auditoria/sefaz", { perfil: "logistica", query: audQuery(f), timeoutMs: 60_000 });
}
export function audPedidos(f: AudFiltro): Promise<AudLista<AudPedidoItem>> {
  return json("/auditoria/pedidos", { perfil: "logistica", query: audQuery(f), timeoutMs: 60_000 });
}
export async function audCategorias(): Promise<{ id: number; nome: string }[]> {
  const r = await json<{ itens: { id: number; nome: string }[] }>("/auditoria/categorias", { perfil: "logistica" });
  return r.itens;
}
