import { getSupabaseAdmin } from "./supabaseAdmin";
import { fetchInBatches } from "./supabaseBatch";
import { vendasDasEntregas } from "./vendaDaEntrega";
import type { FotoEntrega } from "./fotosEntregaOdoo";
import { nomePedidoOdoo } from "./pedidoOdoo";
import { clientesDoCadastro, type ClienteCadastro } from "./clienteCadastro";
import { fotosDoPedidoNaCarga, notasDeEntregaDaCarga, numeroDaCarga } from "./consultaCarga";
import { fotosDaParadaOdoo } from "./fotosEntregaOdoo";
import { buscarEntregas, type BuscaEntrega } from "./odoo/logistica";

// Consulta de pedido (pedido do Victor 26/10/2026: "onde eu vejo as vendas e
// os status dos pedidos"): por CPF/CNPJ, número do pedido, nota da venda ou
// nome, tudo do cliente numa tela -- cada venda com a entrega dela (cada carga
// e tentativa, motorista, resultado e motivo) e o status atual no Protheus.
// Venda e entrega ligadas por cliente + filial + produtos (venda_das_entregas,
// 0200), nunca pela nota da carga (é a de remessa do CD).

const MAX_CLIENTES = 10;
const MAX_VENDAS_POR_BUSCA = 200;
const MAX_ENTREGAS_POR_BUSCA = 200;
const MAX_CARGAS_COM_FOTO = 8;

export type ItemConsulta = { codigo: string | null; descricao: string | null; quantidade: number };

export type VendaConsulta = {
  id: string;
  notaFiscal: string;
  serie: string;
  filial: string;
  data: string;
  vendedor: string | null;
  formaPagamento: string | null;
  valor: number;
  itens: ItemConsulta[];
  // Chave de acesso da NF-e (44 dígitos): a DANFE do Protheus não dá pra
  // gerar sem o XML, mas a chave o atendente passa ao cliente ou consulta na SEFAZ.
  chave: string | null;
};

export type TentativaConsulta = {
  carga: string;
  tentativa: number | null;
  previsao: string | null;
  tipo: string | null;
  statusCarga: string | null;
  statusCargaCodigo: string | null;
  resultadoCodigo: string | null;
  comResultado: boolean;
  motorista: string | null;
  veiculo: string | null;
  transportadora: string | null;
  baixaDia: string | null;
  baixaHora: string | null;
  ocorrencia: string | null;
  itens: ItemConsulta[];
  // Fotos da baixa (só entrega do Odoo -- as do Protheus ficaram no uMov).
  fotos?: FotoEntrega[];
};

export type EntregaConsulta = {
  pedido: string;
  filial: string;
  loja: string | null;
  statusAtual: string | null;
  bairro: string | null;
  cidade: string | null;
  tentativas: TentativaConsulta[];
};

// venda sem entrega = retirada na loja, venda sem carga ainda, ou venda de
// antes do sync das entregas; entrega sem venda = venda não achada (5%).
// Filial de venda, de entrega e se o cliente retira -- Victor 26/10/2026. No
// Odoo vem da expedição/carga (odoo_expedicao); no Protheus só o tipo da
// saída (a filial de entrega ficava na ZAE, que nunca sincronizamos).
export type ModoEntrega = "entrega" | "express" | "retira";
// Situação do pedido no Odoo (Victor 26/10: "se está em separação, previsão
// de carga, previsão de entrega, qual a carga").
// Nota de entrega (5117) do pedido na carga: andamento da emissão pela ponte
// (/logistica/carga/{id}/progresso) -- Victor 27/10: "minha nota já saiu?".
export type NotaEntregaSituacao = { estado: string; nf: string | null; sefaz: string | null };
export type SituacaoPedido = {
  texto: string;
  tom: "bom" | "atencao" | "critico" | "neutro";
  carga: string | null;
  cargaId?: number | null;
  detalhes: string[];
  notaEntrega?: NotaEntregaSituacao;
  // Motorista/veículo da carga atual, quem conferiu (odoo_carga_acoes, 0206) e
  // as fotos da baixa da última carga (disco: odoo-entregas/carga-X/parada-Y).
  motorista?: string | null;
  veiculo?: string | null;
  conferente?: string | null;
  fotoRef?: { cargaId: number; paradaId: number };
  fotos?: FotoEntrega[];
};
export type LogisticaPedido = { filialVenda: string | null; filialEntrega: string | null; modo: ModoEntrega | null; retiraEm: string | null; situacao?: SituacaoPedido };

export type PedidoConsulta = {
  venda: VendaConsulta | null;
  entrega: EntregaConsulta | null;
  criterio: string | null;
  data: string;
  logistica?: LogisticaPedido;
  // Venda do Protheus migrada pro Odoo (mesma nota de venda): a entrega
  // agora anda no Odoo -- Victor 27/10/2026, print do Jonas (NF 31039 = S00672).
  odooLigado?: PedidoOdooConsulta;
};

export type ClienteConsulta = { codigo: string; nome: string | null; documento: string | null; pedidos: PedidoConsulta[] };

// Pedido do Odoo achado direto em odoo_expedicao (expedição + cargas) --
// Victor 26/10/2026: venda nova do Odoo não chega em totvs_* (a compat só
// traz entrega, 1x por dia), então a nota emitida no Odoo nunca aparecia.
// Sem CPF (a expedição não traz): acha por nome, pedido S… ou nº da nota.
export type PedidoOdooConsulta = {
  pedido: string;
  cliente: string | null;
  telefone: string | null;
  empresa: string | null;
  nf5922: string | null;
  nf5117: string | null;
  legado: boolean;
  logistica: LogisticaPedido;
  // Situação em texto, direto do Odoo (/logistica/busca do Pedro): "Na loja
  // 207: peça reservada lá", "Em rota na carga …" etc.
  situacaoOdoo?: string | null;
  // Nota de venda do Protheus a que este pedido corresponde ("NF 31039").
  vendaProtheus?: string | null;
};

export type ResultadoConsulta = {
  busca: string;
  tipo: "documento" | "numero" | "nota" | "nome" | "curta";
  clientes: ClienteConsulta[];
  limitado: boolean;
  odoo?: PedidoOdooConsulta[];
  // CPF que não estava na nossa base: achado no cadastro (clienteCadastro.ts)
  // e procurado pelo nome.
  cadastro?: ClienteCadastro[];
  erroCadastro?: string;
};

const digitos = (s: string) => s.replace(/\D/g, "");

type LinhaExpedicao = {
  pedido: string;
  modo: string | null;
  expresso: boolean | null;
  filial_entrega: string | null;
  retira_em: string | null;
  empresa: string | null;
  data_programada?: string | null;
  pendencia_motivo?: string | null;
  carga_id?: number | null;
  carga_romaneio?: string | null;
  carga_estado?: string | null;
  carga_prevista?: string | null;
  carga_saiu_em?: string | null;
  carga_fim_em?: string | null;
  resultado?: string | null;
  carga_motorista?: string | null;
  carga_veiculo?: string | null;
  parada_id?: number | null;
  ultima_carga_id?: number | null;
};
const COLUNAS_SITUACAO =
  "data_programada, pendencia_motivo, carga_id, carga_romaneio, carga_estado, carga_prevista, carga_saiu_em, carga_fim_em, resultado, carga_motorista, carga_veiculo, parada_id, ultima_carga_id";

const diaBr = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : null);
const horaBr = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Recife", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : null;

const ESTADO_CARGA: Record<string, { texto: string; tom: SituacaoPedido["tom"] }> = {
  montagem: { texto: "Em carga (montagem)", tom: "neutro" },
  separacao: { texto: "Em separação", tom: "neutro" },
  conferida: { texto: "Conferido, aguardando sair", tom: "neutro" },
  liberada: { texto: "Carregado, liberado para sair", tom: "neutro" },
  em_rota: { texto: "Saiu para entrega", tom: "atencao" },
};

export function situacaoDoOdoo(linhas: LinhaExpedicao[], modo: ModoEntrega | null): SituacaoPedido | undefined {
  const s = situacaoBase(linhas, modo);
  if (!s) return s;
  const atual = linhas.find((l) => l.carga_id && l.carga_id === s.cargaId);
  const comFoto = [...linhas].filter((l) => l.ultima_carga_id && l.parada_id).sort((a, b) => (b.ultima_carga_id ?? 0) - (a.ultima_carga_id ?? 0))[0];
  return {
    ...s,
    motorista: atual?.ultima_carga_id === atual?.carga_id ? (atual?.carga_motorista ?? null) : null,
    veiculo: atual?.ultima_carga_id === atual?.carga_id ? (atual?.carga_veiculo ?? null) : null,
    fotoRef: comFoto ? { cargaId: comFoto.ultima_carga_id!, paradaId: comFoto.parada_id! } : undefined,
  };
}

function situacaoBase(linhas: LinhaExpedicao[], modo: ModoEntrega | null): SituacaoPedido | undefined {
  if (linhas.length === 0) return undefined;
  // Linha da carga mais recente (o mesmo pedido pode ter passado por mais de uma).
  const comCarga = [...linhas].filter((l) => l.carga_id).sort((a, b) => (b.carga_id ?? 0) - (a.carga_id ?? 0));
  const c = comCarga[0];
  const naFila = linhas.find((l) => l.modo && !l.carga_id);
  const prog = linhas.map((l) => l.data_programada).find(Boolean);
  const detalhes: string[] = [];
  const carga = c?.carga_romaneio ?? null;
  const cargaId = c?.carga_id ?? null;
  if (c?.carga_prevista) detalhes.push(`carga prevista ${diaBr(c.carga_prevista)}`);
  if (c?.carga_saiu_em) detalhes.push(`saiu ${horaBr(c.carga_saiu_em)}`);
  if (prog) detalhes.push(`programado ${diaBr(prog)}`);

  const ultimo = c?.resultado ?? linhas.map((l) => l.resultado).find(Boolean) ?? null;
  if (naFila) {
    const pend = linhas.map((l) => l.pendencia_motivo).find(Boolean);
    if (pend) return { texto: `Pendência: ${pend}`, tom: "critico", carga: null, detalhes };
    const voltou = ultimo === "insucesso" || ultimo === "reagendada";
    if (modo === "retira") return { texto: "Aguardando o cliente retirar", tom: "atencao", carga: null, detalhes };
    return { texto: voltou ? "Voltou da entrega, aguardando nova carga" : "Aguardando carga", tom: voltou ? "critico" : "neutro", carga: null, detalhes };
  }
  if (!c) return undefined;
  if (c.carga_estado === "cancelada") return { texto: "Carga cancelada", tom: "neutro", carga, cargaId, detalhes };
  if (c.resultado === "entregue") return { texto: "Entregue", tom: "bom", carga, cargaId, detalhes: [...detalhes, ...(c.carga_fim_em ? [`fim da rota ${horaBr(c.carga_fim_em)}`] : [])] };
  if (c.resultado === "entrega_parcial") return { texto: "Entregue em parte", tom: "atencao", carga, cargaId, detalhes };
  if (c.resultado === "insucesso" || c.resultado === "reagendada") return { texto: c.resultado === "reagendada" ? "Reagendado" : "Não entregue", tom: "critico", carga, cargaId, detalhes };
  if (c.carga_estado === "finalizada") return { texto: "Carga finalizada sem baixa deste pedido", tom: "atencao", carga, cargaId, detalhes };
  const e = ESTADO_CARGA[c.carga_estado ?? ""] ?? { texto: "Em carga", tom: "neutro" as const };
  return { ...e, carga, cargaId, detalhes };
}
type LinhaExpedicaoCompleta = LinhaExpedicao & { cliente: string | null; telefone: string | null; nf5922: string | null; nf5117: string | null; legado: boolean };

const MAX_PEDIDOS_ODOO = 20;

export function agruparPedidosOdoo(linhas: LinhaExpedicaoCompleta[], jaMostrados: Set<string>): PedidoOdooConsulta[] {
  const porPedido = new Map<string, LinhaExpedicaoCompleta[]>();
  for (const l of linhas) {
    if (jaMostrados.has(l.pedido)) continue;
    porPedido.set(l.pedido, [...(porPedido.get(l.pedido) ?? []), l]);
  }
  return [...porPedido.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, MAX_PEDIDOS_ODOO)
    .map(([pedido, ls]) => {
      const com = <K extends keyof LinhaExpedicaoCompleta>(k: K) => ls.find((l) => l[k])?.[k] ?? null;
      return {
        pedido,
        cliente: com("cliente") as string | null,
        telefone: com("telefone") as string | null,
        empresa: com("empresa") as string | null,
        nf5922: com("nf5922") as string | null,
        nf5117: com("nf5117") as string | null,
        legado: ls.some((l) => l.legado),
        logistica: logisticaDoOdoo(null, ls),
      };
    });
}

async function pedidosOdooDaBusca(q: string, tipo: ResultadoConsulta["tipo"], jaMostrados: Set<string>): Promise<PedidoOdooConsulta[]> {
  const admin = getSupabaseAdmin();
  const colunas = `pedido, cliente, telefone, empresa, nf5922, nf5117, legado, modo, expresso, filial_entrega, retira_em, ${COLUNAS_SITUACAO}`;
  let consulta = admin.from("odoo_expedicao").select(colunas);
  const nome = nomePedidoOdoo(q);
  const d = digitos(q);
  if (nome) consulta = consulta.eq("pedido", nome);
  else if (tipo === "numero" || tipo === "nota") consulta = consulta.or(`nf5922.eq.${d},nf5117.eq.${d},nf5922.like.${d}/*,nf5117.like.${d}/*`);
  else if (tipo === "nome") consulta = consulta.ilike("cliente", `%${q.replace(/[%_,()]/g, " ")}%`);
  else return [];
  const { data } = await consulta.order("pedido", { ascending: false }).limit(200).returns<LinhaExpedicaoCompleta[]>();
  return agruparPedidosOdoo(data ?? [], jaMostrados);
}

export function modoDoProtheus(tipo: string | null | undefined): ModoEntrega | null {
  if (!tipo) return null;
  if (/retir/i.test(tipo)) return "retira";
  if (/express/i.test(tipo)) return "express";
  return /entrega/i.test(tipo) ? "entrega" : null;
}

export function logisticaDoOdoo(filialVenda: string | null, linhas: LinhaExpedicao[]): LogisticaPedido {
  // A linha com modo (veio da expedição) sabe mais que a da carga.
  const l = [...linhas].sort((a, b) => Number(!!b.modo) - Number(!!a.modo))[0];
  const daEmpresa = l?.empresa?.match(/^\d{3}/)?.[0] ?? null;
  const modo: ModoEntrega | null = !l?.modo ? null : l.modo.startsWith("retira") ? "retira" : l.expresso ? "express" : "entrega";
  return {
    filialVenda,
    filialEntrega: l?.filial_entrega || daEmpresa,
    modo,
    retiraEm: l?.retira_em ?? null,
    situacao: situacaoDoOdoo(linhas, modo),
  };
}

export function tipoDaBusca(q: string): ResultadoConsulta["tipo"] {
  const d = digitos(q);
  if (d && d.length === q.replace(/[\s.\-/]/g, "").length) {
    if (d.length === 11 || d.length === 14) return "documento";
    if (d.length <= 6) return "numero";
    if (d.length <= 9) return "nota";
  }
  return q.trim().length >= 3 ? "nome" : "curta";
}

type DeliveryRow = {
  id: string;
  pedido: string;
  filial_venda: string;
  loja: string | null;
  client_id: string | null;
  client_name: string | null;
  client_cpf_cnpj: string | null;
  client_neighborhood: string | null;
  client_city: string | null;
  status_atual: string | null;
  first_seen_at: string;
  totvs_delivery_cargas: {
    carga: string;
    tentativa: number | null;
    dt_previsao: string | null;
    tipo_entrega: string | null;
    status_carga: string | null;
    status_carga_codigo: string | null;
    status_entrega_codigo: string | null;
    status_origem: string | null;
    motorista_nome: string | null;
    veiculo: string | null;
    transportadora: string | null;
    dt_retorno: string | null;
    hr_retorno: string | null;
    ocorrencia_descricao: string | null;
    totvs_delivery_carga_itens: { produto: string | null; descricao: string | null; quantidade: number | null }[];
  }[];
};

type OrderRow = {
  id: string;
  invoice: string;
  serie: string;
  branch: string;
  issue_date: string;
  seller_name: string | null;
  payment_method: string | null;
  invoice_total: number | null;
  nfe_key: string | null;
  client_id: string | null;
  client_name: string | null;
  client_cpf_cnpj: string | null;
  totvs_order_items: { product: string | null; description: string | null; quantity: number | null }[];
};

const DELIVERY_SELECT =
  "id, pedido, filial_venda, loja, client_id, client_name, client_cpf_cnpj, client_neighborhood, client_city, status_atual, first_seen_at, " +
  "totvs_delivery_cargas(carga, tentativa, dt_previsao, tipo_entrega, status_carga, status_carga_codigo, status_entrega_codigo, status_origem, motorista_nome, veiculo, transportadora, dt_retorno, hr_retorno, ocorrencia_descricao, totvs_delivery_carga_itens(produto, descricao, quantidade))";
const ORDER_SELECT =
  "id, invoice, serie, branch, issue_date, seller_name, payment_method, invoice_total, nfe_key, client_id, client_name, client_cpf_cnpj, totvs_order_items(product, description, quantity)";

async function clientesDaBusca(q: string, tipo: ResultadoConsulta["tipo"]): Promise<string[]> {
  const admin = getSupabaseAdmin();
  const d = digitos(q);
  const ids = new Set<string>();
  const juntar = (rows: { client_id: string | null }[] | null) => rows?.forEach((r) => r.client_id && ids.add(r.client_id));
  if (tipo === "documento") {
    const [a, b] = await Promise.all([
      admin.from("totvs_deliveries").select("client_id").eq("client_cpf_cnpj", d).limit(50),
      admin.from("totvs_orders").select("client_id").eq("client_cpf_cnpj", d).limit(50),
    ]);
    juntar(a.data);
    juntar(b.data);
  } else if (tipo === "numero" || tipo === "nota") {
    // Cada filial tem a própria numeração de pedido e de nota: o mesmo número
    // aparece em várias lojas. A venda mais recente vem primeiro.
    const [a, b] = await Promise.all([
      tipo === "numero"
        ? admin.from("totvs_deliveries").select("client_id").eq("pedido", d.padStart(6, "0")).order("first_seen_at", { ascending: false }).limit(20)
        : Promise.resolve({ data: [] }),
      admin.from("totvs_orders").select("client_id").eq("invoice", d.padStart(9, "0")).order("issue_date", { ascending: false }).limit(20),
    ]);
    juntar(b.data);
    juntar(a.data);
  } else if (tipo === "nome" && nomePedidoOdoo(q)) {
    // Pedido do Odoo (S01589): a camada compat grava "ODOO-S01589".
    const { data } = await admin.from("totvs_deliveries").select("client_id").eq("pedido", `ODOO-${nomePedidoOdoo(q)}`).limit(20);
    juntar(data);
  } else if (tipo === "nome") {
    const termo = `%${q.trim().replace(/[%_,()]/g, " ")}%`;
    const [a, b] = await Promise.all([
      admin.from("totvs_deliveries").select("client_id").ilike("client_name", termo).order("first_seen_at", { ascending: false }).limit(40),
      admin.from("totvs_orders").select("client_id").ilike("client_name", termo).order("issue_date", { ascending: false }).limit(40),
    ]);
    juntar(a.data);
    juntar(b.data);
  }
  return [...ids];
}

function itensDaCarga(c: DeliveryRow["totvs_delivery_cargas"][number]): ItemConsulta[] {
  return (c.totvs_delivery_carga_itens ?? []).map((i) => ({ codigo: i.produto, descricao: i.descricao, quantidade: Number(i.quantidade ?? 0) }));
}

function paraEntrega(d: DeliveryRow): EntregaConsulta {
  const tentativas = [...(d.totvs_delivery_cargas ?? [])]
    .sort((a, b) => (a.dt_previsao ?? "").localeCompare(b.dt_previsao ?? "") || (a.tentativa ?? 0) - (b.tentativa ?? 0))
    .map((c) => ({
      carga: c.carga,
      tentativa: c.tentativa,
      previsao: c.dt_previsao,
      tipo: c.tipo_entrega,
      statusCarga: c.status_carga,
      statusCargaCodigo: c.status_carga_codigo,
      resultadoCodigo: c.status_origem === "ENTREGA" ? c.status_entrega_codigo : null,
      comResultado: c.status_origem === "ENTREGA",
      motorista: c.motorista_nome?.trim() || null,
      veiculo: c.veiculo,
      transportadora: c.transportadora,
      baixaDia: c.status_origem === "ENTREGA" ? c.dt_retorno : null,
      baixaHora: c.status_origem === "ENTREGA" ? c.hr_retorno : null,
      ocorrencia: c.ocorrencia_descricao || null,
      itens: itensDaCarga(c),
    }));
  return {
    pedido: d.pedido,
    filial: d.filial_venda,
    loja: d.loja,
    statusAtual: d.status_atual,
    bairro: d.client_neighborhood,
    cidade: d.client_city,
    tentativas,
  };
}

function paraVenda(o: OrderRow): VendaConsulta {
  return {
    id: o.id,
    notaFiscal: o.invoice,
    serie: o.serie,
    filial: o.branch,
    data: o.issue_date,
    vendedor: o.seller_name,
    formaPagamento: o.payment_method,
    valor: Number(o.invoice_total ?? 0),
    chave: o.nfe_key && o.nfe_key.replace(/\D/g, "").length === 44 ? o.nfe_key.replace(/\D/g, "") : null,
    itens: (o.totvs_order_items ?? []).map((i) => ({ codigo: i.product, descricao: i.description, quantidade: Number(i.quantity ?? 0) })),
  };
}

const MAX_CARGAS_COM_NOTA = 6;

// Situação da nota de entrega de cada pedido do Odoo que está numa carga.
async function anexarNotasDeEntrega(r: ResultadoConsulta): Promise<ResultadoConsulta> {
  const alvos: { s: SituacaoPedido; pedido: string }[] = [];
  for (const c of r.clientes) {
    for (const p of c.pedidos) {
      const nome = p.entrega ? nomePedidoOdoo(p.entrega.pedido) : null;
      if (nome && p.logistica?.situacao?.cargaId) alvos.push({ s: p.logistica.situacao, pedido: nome });
    }
  }
  for (const p of [...(r.odoo ?? []), ...r.clientes.flatMap((c) => c.pedidos.map((x) => x.odooLigado).filter((o): o is PedidoOdooConsulta => !!o))])
    if (p.logistica.situacao?.cargaId) alvos.push({ s: p.logistica.situacao, pedido: p.pedido });
  const cargas = [...new Set(alvos.map((a) => a.s.cargaId!))].slice(0, MAX_CARGAS_COM_NOTA);
  const porCarga = new Map<number, Awaited<ReturnType<typeof notasDeEntregaDaCarga>>>();
  for (let i = 0; i < cargas.length; i += 2) {
    await Promise.all(
      cargas.slice(i, i + 2).map(async (id) => {
        const m = await notasDeEntregaDaCarga(id).catch(() => null);
        if (m) porCarga.set(id, m);
      })
    );
  }
  for (const a of alvos) {
    const n = porCarga.get(a.s.cargaId!)?.get(a.pedido);
    if (n) a.s.notaEntrega = n;
  }
  await anexarConferenteEFotos(r);
  return r;
}

async function anexarConferenteEFotos(r: ResultadoConsulta) {
  const situacoes = [
    ...r.clientes.flatMap((c) => c.pedidos.map((p) => p.logistica?.situacao)),
    ...(r.odoo ?? []).map((p) => p.logistica.situacao),
    ...r.clientes.flatMap((c) => c.pedidos.map((p) => p.odooLigado?.logistica.situacao)),
  ].filter((s): s is SituacaoPedido => !!s);
  const cargas = [...new Set(situacoes.map((s) => s.cargaId).filter((id): id is number => !!id))];
  if (cargas.length) {
    const { data } = await getSupabaseAdmin()
      .from("odoo_carga_acoes")
      .select("carga_id, operador, em")
      .eq("acao", "conferir")
      .in("carga_id", cargas)
      .order("em", { ascending: false })
      .returns<{ carga_id: number; operador: string; em: string }[]>();
    const quem = new Map<number, string>();
    for (const a of data ?? []) if (!quem.has(a.carga_id)) quem.set(a.carga_id, a.operador.replace(/^(CD|Equipe) /, ""));
    for (const s of situacoes) if (s.cargaId) s.conferente = quem.get(s.cargaId) ?? null;
  }
  await Promise.all(
    situacoes.map(async (s) => {
      if (s.fotoRef) s.fotos = await fotosDaParadaOdoo(s.fotoRef.cargaId, s.fotoRef.paradaId).catch(() => []);
    })
  );
}

export async function consultarPedidos(busca: string): Promise<ResultadoConsulta> {
  const r = await consultarSemNotas(busca);
  // CPF achado na nossa base: os pedidos do Odoo do mesmo cliente também pelo
  // nome (a expedição não tem CPF) -- assim CPF e nome mostram a mesma coisa
  // mesmo se a busca do Odoo não responder.
  if (r.tipo === "documento" && r.clientes[0]?.nome) {
    const jaTem = new Set((r.odoo ?? []).map((o) => o.pedido));
    const porNome = await pedidosOdooDaBusca(r.clientes[0].nome, "nome", jaTem).catch(() => []);
    r.odoo = [...(r.odoo ?? []), ...porNome];
  }
  if (r.tipo !== "curta") r.odoo = await juntarBuscaDoOdoo(r, busca.trim());
  ligarVendasMigradas(r);
  return anexarNotasDeEntrega(r);
}

// Venda do Protheus que foi migrada pro Odoo: o pedido do Odoo guarda a nota de
// venda do Protheus em nf5922 ("31039/1" = nota 31039, série 1). Casa com a
// venda sem entrega do Protheus e mostra os dois no mesmo cartão (o pedido sai
// da lista "Pedidos do Odoo"). Mesma nota em mais de uma filial: só liga se
// for uma venda só.
export function ligarVendasMigradas(r: ResultadoConsulta) {
  if (!r.odoo?.length) return;
  const vendasSemEntrega = r.clientes.flatMap((c) => c.pedidos).filter((p) => p.venda && !p.entrega && !p.odooLigado);
  const ligados = new Set<string>();
  for (const o of r.odoo) {
    const m = (o.nf5922 ?? "").match(/^0*(\d+)\/(\w+)$/);
    if (!m) continue;
    const iguais = vendasSemEntrega.filter((p) => p.venda!.notaFiscal.replace(/^0+/, "") === m[1] && p.venda!.serie.trim() === m[2] && !p.odooLigado);
    if (iguais.length !== 1) continue;
    iguais[0].odooLigado = { ...o, vendaProtheus: `NF ${m[1]}` };
    ligados.add(o.pedido);
  }
  r.odoo = r.odoo.filter((o) => !ligados.has(o.pedido));
}

// Pergunta direto ao Odoo (/logistica/busca do Pedro: CPF/CNPJ com ou sem
// pontuação, nome, pedido ou nota; < 1,5 s) -- Victor 27/10/2026: cliente
// novo do Odoo não estava em lugar nenhum nosso, então o CPF não achava.
// Junta com o que já veio de odoo_expedicao (motorista, fotos, situação).
export function cartaoDaBusca(i: BuscaEntrega): PedidoOdooConsulta {
  const modo: ModoEntrega | null = !i.modo ? null : i.modo.startsWith("retira") ? "retira" : "entrega";
  return {
    pedido: i.pedido,
    cliente: i.cliente || null,
    telefone: null,
    empresa: i.loja || null,
    nf5922: i.nf5922 || null,
    nf5117: i.nf5117 || null,
    legado: false,
    logistica: { filialVenda: /^\d{3}$/.test(i.loja ?? "") ? i.loja : null, filialEntrega: null, modo, retiraEm: null },
    situacaoOdoo: i.situacao || null,
  };
}

async function juntarBuscaDoOdoo(r: ResultadoConsulta, q: string): Promise<PedidoOdooConsulta[]> {
  const atuais = r.odoo ?? [];
  if (q.length < 3) return atuais;
  const itens = await buscarEntregas(q).catch(() => [] as BuscaEntrega[]);
  if (itens.length === 0) return atuais;
  const porPedido = new Map(itens.map((i) => [i.pedido, i]));
  for (const p of atuais) {
    const i = porPedido.get(p.pedido);
    p.situacaoOdoo ??= i?.situacao ?? null;
    p.nf5922 ??= i?.nf5922 || null;
    p.nf5117 ??= i?.nf5117 || null;
  }
  const jaMostrados = new Set([
    ...atuais.map((p) => p.pedido),
    ...r.clientes.flatMap((c) => c.pedidos.map((p) => (p.entrega ? nomePedidoOdoo(p.entrega.pedido) : null)).filter((n): n is string => !!n)),
  ]);
  const novos = [...porPedido.keys()].filter((n) => !jaMostrados.has(n));
  if (novos.length === 0) return atuais;
  const { data } = await getSupabaseAdmin()
    .from("odoo_expedicao")
    .select(`pedido, cliente, telefone, empresa, nf5922, nf5117, legado, modo, expresso, filial_entrega, retira_em, ${COLUNAS_SITUACAO}`)
    .in("pedido", novos)
    .returns<LinhaExpedicaoCompleta[]>();
  const daTabela = new Map(agruparPedidosOdoo(data ?? [], new Set()).map((p) => [p.pedido, p]));
  const extras = novos.map((n) => {
    const i = porPedido.get(n)!;
    const t = daTabela.get(n);
    return t ? { ...t, nf5922: t.nf5922 ?? (i.nf5922 || null), nf5117: t.nf5117 ?? (i.nf5117 || null), situacaoOdoo: i.situacao || null } : cartaoDaBusca(i);
  });
  return [...atuais, ...extras];
}

async function consultarSemNotas(busca: string): Promise<ResultadoConsulta> {
  const r = await consultarBase(busca);
  if (r.tipo === "curta") return r;
  if (r.tipo === "documento" && r.clientes.length === 0) return consultarPeloCadastro(busca.trim());
  const jaMostrados = new Set(r.clientes.flatMap((c) => c.pedidos.map((p) => (p.entrega ? nomePedidoOdoo(p.entrega.pedido) : null)).filter((n): n is string => !!n)));
  const odoo = await pedidosOdooDaBusca(busca.trim(), r.tipo, jaMostrados).catch(() => []);
  return { ...r, odoo };
}

async function consultarPeloCadastro(q: string): Promise<ResultadoConsulta> {
  let cadastro: ClienteCadastro[];
  try {
    cadastro = await clientesDoCadastro(q);
  } catch (err) {
    return { busca: q, tipo: "documento", clientes: [], limitado: false, odoo: [], erroCadastro: (err as Error).message };
  }
  if (cadastro.length === 0) return { busca: q, tipo: "documento", clientes: [], limitado: false, odoo: [], cadastro };
  const nome = cadastro[0].nome;
  const porNome = await consultarBase(nome);
  // Homônimo: só fica o cliente com esse documento ou sem documento na nossa base.
  const clientes = porNome.clientes.filter((c) => !c.documento || c.documento.replace(/\D/g, "") === cadastro[0].documento);
  const jaMostrados = new Set(clientes.flatMap((c) => c.pedidos.map((p) => (p.entrega ? nomePedidoOdoo(p.entrega.pedido) : null)).filter((n): n is string => !!n)));
  const odoo = await pedidosOdooDaBusca(nome, "nome", jaMostrados).catch(() => []);
  return { busca: q, tipo: "documento", clientes, limitado: false, odoo, cadastro };
}

async function consultarBase(busca: string): Promise<ResultadoConsulta> {
  const q = busca.trim();
  const tipo = tipoDaBusca(q);
  if (tipo === "curta") return { busca: q, tipo, clientes: [], limitado: false };

  const todos = await clientesDaBusca(q, tipo);
  const clienteIds = todos.slice(0, MAX_CLIENTES);
  if (clienteIds.length === 0) return { busca: q, tipo, clientes: [], limitado: false };

  const admin = getSupabaseAdmin();
  const [entregas, vendas] = await Promise.all([
    fetchInBatches<DeliveryRow>(clienteIds, (lote) =>
      admin.from("totvs_deliveries").select(DELIVERY_SELECT).in("client_id", lote).order("first_seen_at", { ascending: false }).limit(MAX_ENTREGAS_POR_BUSCA).returns<DeliveryRow[]>()
    ),
    fetchInBatches<OrderRow>(clienteIds, (lote) =>
      admin.from("totvs_orders").select(ORDER_SELECT).in("client_id", lote).eq("type", "Venda").order("issue_date", { ascending: false }).limit(MAX_VENDAS_POR_BUSCA).returns<OrderRow[]>()
    ),
  ]);
  const ligacao = await vendasDasEntregas(admin, entregas.map((e) => e.id));
  const vendaPorId = new Map(vendas.map((v) => [v.id, v]));
  const usadas = new Set<string>();

  const porCliente = new Map<string, ClienteConsulta>();
  const cliente = (codigo: string, nome: string | null, documento: string | null) => {
    const c = porCliente.get(codigo) ?? { codigo, nome, documento, pedidos: [] };
    c.nome ??= nome;
    c.documento ??= documento;
    porCliente.set(codigo, c);
    return c;
  };

  for (const e of entregas) {
    if (!e.client_id) continue;
    const l = ligacao.get(e.id);
    const v = l ? vendaPorId.get(l.orderId) : undefined;
    if (v) usadas.add(v.id);
    const entrega = paraEntrega(e);
    const primeira = entrega.tentativas[0]?.previsao ?? e.first_seen_at.slice(0, 10);
    cliente(e.client_id, e.client_name, e.client_cpf_cnpj).pedidos.push({
      venda: v ? paraVenda(v) : null,
      entrega,
      criterio: l?.criterio ?? null,
      data: v?.issue_date ?? primeira,
    });
  }
  for (const v of vendas) {
    if (usadas.has(v.id) || !v.client_id) continue;
    cliente(v.client_id, v.client_name, v.client_cpf_cnpj).pedidos.push({ venda: paraVenda(v), entrega: null, criterio: null, data: v.issue_date });
  }
  // Fotos da baixa nas tentativas do Odoo: no máximo 8 tentativas por busca, 2
  // leituras da ponte por vez; falha da ponte só deixa sem foto.
  const tentativasOdoo = [...porCliente.values()]
    .flatMap((c) => c.pedidos)
    .flatMap((p) => {
      const nome = p.entrega ? nomePedidoOdoo(p.entrega.pedido) : null;
      return nome ? p.entrega!.tentativas.filter((t) => numeroDaCarga(t.carga)).map((t) => ({ t, nome })) : [];
    })
    .slice(0, MAX_CARGAS_COM_FOTO);
  for (let i = 0; i < tentativasOdoo.length; i += 2) {
    await Promise.all(
      tentativasOdoo.slice(i, i + 2).map(async ({ t, nome }) => {
        t.fotos = await fotosDoPedidoNaCarga(t.carga, nome).catch(() => []);
      })
    );
  }

  const nomesOdoo = [...porCliente.values()].flatMap((c) => c.pedidos.map((p) => (p.entrega ? nomePedidoOdoo(p.entrega.pedido) : null))).filter((n): n is string => !!n);
  const expedicao = nomesOdoo.length
    ? (await admin.from("odoo_expedicao").select(`pedido, modo, expresso, filial_entrega, retira_em, empresa, ${COLUNAS_SITUACAO}`).in("pedido", [...new Set(nomesOdoo)]).returns<LinhaExpedicao[]>()).data ?? []
    : [];
  for (const c of porCliente.values()) {
    for (const p of c.pedidos) {
      const filialVenda = p.entrega?.filial ?? p.venda?.filial ?? null;
      const nome = p.entrega ? nomePedidoOdoo(p.entrega.pedido) : null;
      p.logistica = nome
        ? logisticaDoOdoo(filialVenda, expedicao.filter((l) => l.pedido === nome))
        : { filialVenda, filialEntrega: null, modo: modoDoProtheus(p.entrega?.tentativas.at(-1)?.tipo), retiraEm: null };
    }
    c.pedidos.sort((a, b) => b.data.localeCompare(a.data));
  }

  const clientes = clienteIds.map((id) => porCliente.get(id)).filter((c): c is ClienteConsulta => !!c);
  return { busca: q, tipo, clientes, limitado: todos.length > MAX_CLIENTES };
}
