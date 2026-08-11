import { getSupabaseAdmin } from "./supabaseAdmin";

// Tela "Cargas" do SAC/admin (ver 0072_carga_conferente_e_problemas.sql):
// lista as cargas sincronizadas do TOTVS dos últimos DIAS_RETROATIVOS dias,
// agrupadas pelo código da carga -- uma carga física carrega vários
// pedidos/clientes diferentes na mesma viagem (um totvs_delivery_cargas por
// pedido, todos compartilhando o mesmo `carga`), então os campos da viagem
// em si (motorista, conferente, transportadora, veículo) só fazem sentido
// olhados uma vez por grupo, mesmo vindo repetidos em cada linha.
const DIAS_RETROATIVOS = 30;

export type CargaProblema = {
  id: string;
  description: string;
  reportedByName: string;
  createdAt: string;
};

export type CargaPedidoItem = {
  cargaRowId: string;
  pedido: string;
  filialVenda: string;
  loja: string | null;
  clienteNome: string | null;
  clienteCodigo: string | null;
  clienteDocumento: string | null;
  tentativa: number | null;
  statusEntrega: string | null;
  ocorrenciaDescricao: string | null;
  problemas: CargaProblema[];
};

export type CargaGroup = {
  carga: string;
  dtPrevisao: string | null;
  statusCarga: string | null;
  motoristaNome: string | null;
  conferenteNome: string | null;
  transportadora: string | null;
  veiculo: string | null;
  pedidos: CargaPedidoItem[];
};

type CargaRow = {
  id: string;
  carga: string;
  dt_previsao: string | null;
  status_carga: string | null;
  status_entrega: string | null;
  tentativa: number | null;
  motorista_nome: string | null;
  conferente_nome: string | null;
  transportadora: string | null;
  veiculo: string | null;
  ocorrencia_descricao: string | null;
  totvs_deliveries: {
    pedido: string;
    filial_venda: string;
    loja: string | null;
    client_name: string | null;
    client_id: string | null;
    client_cpf_cnpj: string | null;
  } | null;
  carga_problemas: {
    id: string;
    description: string;
    reported_by_name: string;
    created_at: string;
  }[];
};

const CARGA_COLUMNS =
  "id, carga, dt_previsao, status_carga, status_entrega, tentativa, motorista_nome, conferente_nome, transportadora, veiculo, ocorrencia_descricao, " +
  "totvs_deliveries!inner(pedido, filial_venda, loja, client_name, client_id, client_cpf_cnpj), " +
  "carga_problemas(id, description, reported_by_name, created_at)";

export async function listCargasRecentes(): Promise<CargaGroup[]> {
  const admin = getSupabaseAdmin();
  const cutoff = new Date(Date.now() - DIAS_RETROATIVOS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data, error } = await admin
    .from("totvs_delivery_cargas")
    .select(CARGA_COLUMNS)
    .or(`dt_previsao.gte.${cutoff},dt_previsao.is.null`)
    .order("dt_previsao", { ascending: false });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as CargaRow[];
  const groups = new Map<string, CargaGroup>();

  for (const row of rows) {
    if (!row.totvs_deliveries) continue;

    let group = groups.get(row.carga);
    if (!group) {
      group = {
        carga: row.carga,
        dtPrevisao: row.dt_previsao,
        statusCarga: row.status_carga,
        motoristaNome: row.motorista_nome,
        conferenteNome: row.conferente_nome,
        transportadora: row.transportadora,
        veiculo: row.veiculo,
        pedidos: [],
      };
      groups.set(row.carga, group);
    }

    group.pedidos.push({
      cargaRowId: row.id,
      pedido: row.totvs_deliveries.pedido,
      filialVenda: row.totvs_deliveries.filial_venda,
      loja: row.totvs_deliveries.loja,
      clienteNome: row.totvs_deliveries.client_name,
      clienteCodigo: row.totvs_deliveries.client_id,
      clienteDocumento: row.totvs_deliveries.client_cpf_cnpj,
      tentativa: row.tentativa,
      statusEntrega: row.status_entrega,
      ocorrenciaDescricao: row.ocorrencia_descricao,
      problemas: row.carga_problemas
        .map((p) => ({ id: p.id, description: p.description, reportedByName: p.reported_by_name, createdAt: p.created_at }))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    });
  }

  return [...groups.values()].sort((a, b) => (b.dtPrevisao ?? "").localeCompare(a.dtPrevisao ?? ""));
}

export async function addCargaProblema(
  cargaRowId: string,
  description: string,
  actor: { id: string; name: string; role: "sac" | "admin" }
): Promise<void> {
  const trimmed = description.trim();
  if (!trimmed) throw new Error("Descreva o problema.");

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("carga_problemas").insert({
    carga_id: cargaRowId,
    description: trimmed,
    reported_by_id: actor.id,
    reported_by_name: actor.name,
    reported_by_role: actor.role,
  });
  if (error) throw new Error(error.message);
}
