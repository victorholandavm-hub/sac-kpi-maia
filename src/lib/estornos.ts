import { getSupabaseAdmin } from "./supabaseAdmin";

// Estornos (reembolsos) -- pedido do Victor 22/09/2026: nova aba "Estornos"
// em /clientes. Histórico curado à mão a partir do grupo de WhatsApp "Lojas
// Maia e Líder Caixas" (ver migration 0135_estornos.sql pro backfill dos 59
// casos de referência, 27/07 a 06/09/2026) -- sem sync automático (não
// existe API de estorno nenhuma pra puxar isso do Protheus), mesmo espírito
// de store_google_reviews (googleReviews.ts): tabela pequena, alimentada à
// mão, sem paginação server-side (fetch tudo, filtra/pagina em JS -- mesmo
// padrão de listClientesPorNivel/listRecompraCandidatos neste mesmo domínio,
// não o de listClientes, que pagina no banco por lidar com totvs_clientes
// inteiro).
export type EstornoRow = {
  id: string;
  dataSolicitacao: string;
  cliente: string;
  cpfCnpj: string | null;
  codigoCliente: string | null;
  valorReembolso: number;
  dataVenda: string | null;
  formaPagamento: string | null;
  motivo: string | null;
  produto: string | null;
  autorizadoPor: string | null;
  loja: string;
  status: string | null;
};

type EstornoDbRow = {
  id: string;
  data_solicitacao: string;
  cliente: string;
  cpf_cnpj: string | null;
  codigo_cliente: string | null;
  valor_reembolso: number;
  data_venda: string | null;
  forma_pagamento: string | null;
  motivo: string | null;
  produto: string | null;
  autorizado_por: string | null;
  loja: string;
  status: string | null;
};

function toEstornoRow(r: EstornoDbRow): EstornoRow {
  return {
    id: r.id,
    dataSolicitacao: r.data_solicitacao,
    cliente: r.cliente,
    cpfCnpj: r.cpf_cnpj,
    codigoCliente: r.codigo_cliente,
    valorReembolso: Number(r.valor_reembolso),
    dataVenda: r.data_venda,
    formaPagamento: r.forma_pagamento,
    motivo: r.motivo,
    produto: r.produto,
    autorizadoPor: r.autorizado_por,
    loja: r.loja,
    status: r.status,
  };
}

// Mais recente primeiro -- data da SOLICITAÇÃO (não da venda), é o que
// importa pro fluxo operacional (quem chegou pedindo agora). Desempate por
// created_at -- solicitações do mesmo dia, quem foi cadastrada por último
// aparece primeiro.
export async function listEstornos(): Promise<EstornoRow[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("estornos")
    .select(
      "id, data_solicitacao, cliente, cpf_cnpj, codigo_cliente, valor_reembolso, data_venda, forma_pagamento, motivo, produto, autorizado_por, loja, status"
    )
    .order("data_solicitacao", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as EstornoDbRow[]).map(toEstornoRow);
}

export type NovoEstornoInput = {
  dataSolicitacao: string;
  cliente: string;
  cpfCnpj: string | null;
  codigoCliente: string | null;
  valorReembolso: number;
  dataVenda: string | null;
  formaPagamento: string | null;
  motivo: string | null;
  produto: string | null;
  autorizadoPor: string | null;
  loja: string;
  status: string | null;
};

export async function createEstorno(input: NovoEstornoInput): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("estornos").insert({
    data_solicitacao: input.dataSolicitacao,
    cliente: input.cliente.trim(),
    cpf_cnpj: input.cpfCnpj?.trim() || null,
    codigo_cliente: input.codigoCliente?.trim() || null,
    valor_reembolso: input.valorReembolso,
    data_venda: input.dataVenda || null,
    forma_pagamento: input.formaPagamento?.trim() || null,
    motivo: input.motivo?.trim() || null,
    produto: input.produto?.trim() || null,
    autorizado_por: input.autorizadoPor?.trim() || null,
    loja: input.loja.trim(),
    status: input.status?.trim() || null,
  });
  if (error) throw new Error(error.message);
}
