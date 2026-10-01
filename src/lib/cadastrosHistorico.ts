import { getSupabaseAdmin } from "./supabaseAdmin";

// Cadastros -- histórico de assistência pré-sistema (planilha "Solicitações
// de Assistência", Dez/2024-Out/2026, importada uma única vez em
// 0146_assistencia_cadastros_historico.sql). Só leitura -- sem action de
// criar/editar/apagar aqui, é registro histórico congelado, não fila de
// trabalho. Ver comentário completo da migration pra entender tipo/status/
// prazo (inferidos a partir de uma planilha sem essas colunas prontas).
export const CADASTRO_TIPOS = ["ASSISTENCIA", "TROCA", "ERRO_ENTREGA", "ERRO_FATURAMENTO", "MONTAGEM", "HISTORICO"] as const;
export type CadastroTipo = (typeof CADASTRO_TIPOS)[number];

export const CADASTRO_TIPO_LABELS: Record<CadastroTipo, string> = {
  ASSISTENCIA: "Assistência",
  TROCA: "Troca",
  ERRO_ENTREGA: "Erro de entrega",
  ERRO_FATURAMENTO: "Erro de faturamento",
  MONTAGEM: "Montagem",
  HISTORICO: "Histórico (sem tipo na planilha original)",
};

// Cor por tipo -- mesma família de badge colorida que o resto do sistema
// usa pra "tipo de chamado" (ver DELIVERY_TYPE_COLORS, AssistenciaQueueGroup.tsx).
export const CADASTRO_TIPO_COLORS: Record<CadastroTipo, string> = {
  ASSISTENCIA: "#2563EB",
  TROCA: "#D97706",
  ERRO_ENTREGA: "#DC2626",
  ERRO_FATURAMENTO: "#B91C1C",
  MONTAGEM: "#16A34A",
  HISTORICO: "#6B7280",
};

export const CADASTRO_STATUSES = ["PROGRAMADO", "CONCLUIDO", "CANCELADO"] as const;
export type CadastroStatus = (typeof CADASTRO_STATUSES)[number];

export const CADASTRO_STATUS_LABELS: Record<CadastroStatus, string> = {
  PROGRAMADO: "Programado",
  CONCLUIDO: "Concluído",
  CANCELADO: "Não concluído",
};

export type Cadastro = {
  id: string;
  tipo: CadastroTipo;
  tipoOriginal: string | null;
  codigo: string | null;
  produto: string | null;
  descricao: string | null;
  nf: string | null;
  vendedora: string | null;
  loja: string | null;
  cliente: string | null;
  endereco: string | null;
  cpf: string | null;
  telefone: string | null;
  dataAbertura: string | null;
  solicitante: string | null;
  prazoData: string | null;
  prazoCalculado: boolean;
  prazoNota: string | null;
  quemMontou: string | null;
  obs: string | null;
  status: CadastroStatus;
  origemPlanilha: string;
};

type Row = {
  id: string;
  tipo: CadastroTipo;
  tipo_original: string | null;
  codigo: string | null;
  produto: string | null;
  descricao: string | null;
  nf: string | null;
  vendedora: string | null;
  loja: string | null;
  cliente: string | null;
  endereco: string | null;
  cpf: string | null;
  telefone: string | null;
  data_abertura: string | null;
  solicitante: string | null;
  prazo_data: string | null;
  prazo_calculado: boolean;
  prazo_nota: string | null;
  quem_montou: string | null;
  obs: string | null;
  status: CadastroStatus;
  origem_planilha: string;
};

const COLUMNS =
  "id, tipo, tipo_original, codigo, produto, descricao, nf, vendedora, loja, cliente, endereco, cpf, telefone, data_abertura, solicitante, prazo_data, prazo_calculado, prazo_nota, quem_montou, obs, status, origem_planilha";

function toCadastro(row: Row): Cadastro {
  return {
    id: row.id,
    tipo: row.tipo,
    tipoOriginal: row.tipo_original,
    codigo: row.codigo,
    produto: row.produto,
    descricao: row.descricao,
    nf: row.nf,
    vendedora: row.vendedora,
    loja: row.loja,
    cliente: row.cliente,
    endereco: row.endereco,
    cpf: row.cpf,
    telefone: row.telefone,
    dataAbertura: row.data_abertura,
    solicitante: row.solicitante,
    prazoData: row.prazo_data,
    prazoCalculado: row.prazo_calculado,
    prazoNota: row.prazo_nota,
    quemMontou: row.quem_montou,
    obs: row.obs,
    status: row.status,
    origemPlanilha: row.origem_planilha,
  };
}

// "Volta pra caixa"/"Esperar de fábrica" -- pedido do Victor 01/10/2026,
// raro na base real (~10 e ~2 linhas em 3.244) e o texto mora mais em
// PRAZO (anotação livre) do que em OBS -- procura nos dois campos.
const VOLTA_CAIXA_PATTERN = "%volta%caixa%";
const ESPERAR_FABRICA_PATTERN_1 = "%esperar%fabric%";
const ESPERAR_FABRICA_PATTERN_2 = "%chegar%fabric%";

export type CadastroEspecial = "volta_caixa" | "esperar_fabrica";

export type ListCadastrosOpts = {
  tipo?: CadastroTipo;
  // Filtro por VÁRIOS tipos de uma vez (ex.: pill "Erros de Entrega/
  // Faturamento" cobre ERRO_ENTREGA + ERRO_FATURAMENTO juntos) -- tem
  // prioridade sobre `tipo` quando os dois vêm preenchidos.
  tipos?: CadastroTipo[];
  especial?: CadastroEspecial;
  status?: CadastroStatus;
  loja?: string;
  solicitante?: string;
  q?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
};

export type ListCadastrosResult = { items: Cadastro[]; total: number };

function applyFilters<T>(query: T, opts: ListCadastrosOpts): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = query as any;
  if (opts.tipos && opts.tipos.length > 0) q = q.in("tipo", opts.tipos);
  else if (opts.tipo) q = q.eq("tipo", opts.tipo);
  if (opts.status) q = q.eq("status", opts.status);
  if (opts.loja) q = q.eq("loja", opts.loja);
  if (opts.solicitante) q = q.eq("solicitante", opts.solicitante);
  if (opts.dateFrom) q = q.gte("data_abertura", opts.dateFrom);
  if (opts.dateTo) q = q.lte("data_abertura", opts.dateTo);
  if (opts.especial === "volta_caixa") {
    q = q.or(`obs.ilike.${VOLTA_CAIXA_PATTERN},prazo_nota.ilike.${VOLTA_CAIXA_PATTERN}`);
  } else if (opts.especial === "esperar_fabrica") {
    q = q.or(
      `obs.ilike.${ESPERAR_FABRICA_PATTERN_1},prazo_nota.ilike.${ESPERAR_FABRICA_PATTERN_1},obs.ilike.${ESPERAR_FABRICA_PATTERN_2},prazo_nota.ilike.${ESPERAR_FABRICA_PATTERN_2}`
    );
  }
  if (opts.q) {
    const term = opts.q.trim();
    if (term) {
      const pattern = `%${term}%`;
      q = q.or(
        `cliente.ilike.${pattern},produto.ilike.${pattern},cpf.ilike.${pattern},telefone.ilike.${pattern},nf.ilike.${pattern}`
      );
    }
  }
  return q as T;
}

export const CADASTROS_PAGE_SIZE = 50;

export async function listCadastros(opts: ListCadastrosOpts = {}): Promise<ListCadastrosResult> {
  const admin = getSupabaseAdmin();
  const pageSize = opts.pageSize ?? CADASTROS_PAGE_SIZE;
  const page = Math.max(1, opts.page ?? 1);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = admin.from("assistencia_cadastros_historico").select(COLUMNS, { count: "exact" });
  query = applyFilters(query, opts);
  const { data, count, error } = await query.order("data_abertura", { ascending: false, nullsFirst: false }).range(from, to);
  if (error) throw new Error(error.message);
  return { items: ((data ?? []) as unknown as Row[]).map(toCadastro), total: count ?? 0 };
}

export type CadastroPillCounts = Record<CadastroTipo, number> & { total: number; voltaCaixa: number; esperarFabrica: number };

// Contadores dos pills do topo -- uma query por contador (poucas, cada uma
// só `head: true, count: "exact"`, sem trazer linha nenhuma) é mais simples
// e robusto do que tentar um `group by` via PostgREST pra isso.
export async function getCadastroPillCounts(): Promise<CadastroPillCounts> {
  const admin = getSupabaseAdmin();
  const table = () => admin.from("assistencia_cadastros_historico").select("id", { count: "exact", head: true });

  const [total, ...tipoCounts] = await Promise.all([
    table(),
    ...CADASTRO_TIPOS.map((tipo) => table().eq("tipo", tipo)),
  ]);
  const [voltaCaixa, esperarFabrica] = await Promise.all([
    table().or(`obs.ilike.${VOLTA_CAIXA_PATTERN},prazo_nota.ilike.${VOLTA_CAIXA_PATTERN}`),
    table().or(
      `obs.ilike.${ESPERAR_FABRICA_PATTERN_1},prazo_nota.ilike.${ESPERAR_FABRICA_PATTERN_1},obs.ilike.${ESPERAR_FABRICA_PATTERN_2},prazo_nota.ilike.${ESPERAR_FABRICA_PATTERN_2}`
    ),
  ]);

  const result = { total: total.count ?? 0, voltaCaixa: voltaCaixa.count ?? 0, esperarFabrica: esperarFabrica.count ?? 0 } as CadastroPillCounts;
  CADASTRO_TIPOS.forEach((tipo, i) => {
    result[tipo] = tipoCounts[i].count ?? 0;
  });
  return result;
}

export async function listCadastroLojas(): Promise<string[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("assistencia_cadastros_historico").select("loja").not("loja", "is", null);
  if (error) throw new Error(error.message);
  return [...new Set((data ?? []).map((r) => r.loja as string))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export type CadastroResumoSolicitante = { solicitante: string; programado: number; concluido: number; cancelado: number; total: number };

// Cards "Equipe X" -- agrupado por solicitante (quem registrou o chamado
// internamente), pedido do Victor 01/10/2026. Nome vem bem inconsistente
// na planilha original (iasmyn/IASMYN/Iasmyn) -- normaliza por
// title-case antes de agrupar, senão a mesma pessoa vira 3 cards
// separados.
function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export async function getCadastrosResumoPorSolicitante(): Promise<CadastroResumoSolicitante[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("assistencia_cadastros_historico")
    .select("solicitante, status")
    .not("solicitante", "is", null);
  if (error) throw new Error(error.message);

  const byName = new Map<string, CadastroResumoSolicitante>();
  for (const row of data ?? []) {
    const raw = (row.solicitante as string).trim();
    if (!raw) continue;
    const name = titleCase(raw);
    const entry = byName.get(name) ?? { solicitante: name, programado: 0, concluido: 0, cancelado: 0, total: 0 };
    entry.total++;
    if (row.status === "CONCLUIDO") entry.concluido++;
    else if (row.status === "CANCELADO") entry.cancelado++;
    else entry.programado++;
    byName.set(name, entry);
  }
  return [...byName.values()].sort((a, b) => b.total - a.total);
}
