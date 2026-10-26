import { getSupabaseAdmin } from "./supabaseAdmin";
import { fetchInBatches } from "./supabaseBatch";
import { vendasDasEntregas } from "./vendaDaEntrega";
import type { FotoEntrega } from "./fotosEntregaOdoo";
import { nomePedidoOdoo } from "./pedidoOdoo";
import { fotosDoPedidoNaCarga, numeroDaCarga } from "./consultaCarga";

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
export type LogisticaPedido = { filialVenda: string | null; filialEntrega: string | null; modo: ModoEntrega | null; retiraEm: string | null };

export type PedidoConsulta = {
  venda: VendaConsulta | null;
  entrega: EntregaConsulta | null;
  criterio: string | null;
  data: string;
  logistica?: LogisticaPedido;
};

export type ClienteConsulta = { codigo: string; nome: string | null; documento: string | null; pedidos: PedidoConsulta[] };

export type ResultadoConsulta = { busca: string; tipo: "documento" | "numero" | "nota" | "nome" | "curta"; clientes: ClienteConsulta[]; limitado: boolean };

const digitos = (s: string) => s.replace(/\D/g, "");

type LinhaExpedicao = { pedido: string; modo: string | null; expresso: boolean | null; filial_entrega: string | null; retira_em: string | null; empresa: string | null };

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
  return {
    filialVenda,
    filialEntrega: l?.filial_entrega || daEmpresa,
    modo: !l?.modo ? null : l.modo.startsWith("retira") ? "retira" : l.expresso ? "express" : "entrega",
    retiraEm: l?.retira_em ?? null,
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
  client_id: string | null;
  client_name: string | null;
  client_cpf_cnpj: string | null;
  totvs_order_items: { product: string | null; description: string | null; quantity: number | null }[];
};

const DELIVERY_SELECT =
  "id, pedido, filial_venda, loja, client_id, client_name, client_cpf_cnpj, client_neighborhood, client_city, status_atual, first_seen_at, " +
  "totvs_delivery_cargas(carga, tentativa, dt_previsao, tipo_entrega, status_carga, status_carga_codigo, status_entrega_codigo, status_origem, motorista_nome, veiculo, transportadora, dt_retorno, hr_retorno, ocorrencia_descricao, totvs_delivery_carga_itens(produto, descricao, quantidade))";
const ORDER_SELECT =
  "id, invoice, serie, branch, issue_date, seller_name, payment_method, invoice_total, client_id, client_name, client_cpf_cnpj, totvs_order_items(product, description, quantity)";

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
    itens: (o.totvs_order_items ?? []).map((i) => ({ codigo: i.product, descricao: i.description, quantidade: Number(i.quantity ?? 0) })),
  };
}

export async function consultarPedidos(busca: string): Promise<ResultadoConsulta> {
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
    ? (await admin.from("odoo_expedicao").select("pedido, modo, expresso, filial_entrega, retira_em, empresa").in("pedido", [...new Set(nomesOdoo)]).returns<LinhaExpedicao[]>()).data ?? []
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
