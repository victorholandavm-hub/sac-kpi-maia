import { getSupabaseAdmin } from "./supabaseAdmin";

// Cadastros -- histórico de assistência pré-sistema (planilha "Solicitações
// de Assistência", Dez/2024-Out/2026, importada uma única vez em
// 0146_assistencia_cadastros_historico.sql) + cadastros novos lançados daqui
// pra frente direto pelo sistema (ver addCadastroHistorico abaixo, pedido do
// Victor 01/10/2026 depois de aprovar o protótipo em Artifact). Ver
// comentário completo da migration pra entender tipo/status/prazo das linhas
// IMPORTADAS (inferidos a partir de uma planilha sem essas colunas prontas)
// -- um cadastro novo já nasce com essa informação de verdade, sem precisar
// inferir nada.
export const CADASTRO_TIPOS = ["ASSISTENCIA", "TROCA", "ERRO_ENTREGA", "ERRO_FATURAMENTO", "MONTAGEM", "HISTORICO", "SAC"] as const;
export type CadastroTipo = (typeof CADASTRO_TIPOS)[number];

export const CADASTRO_TIPO_LABELS: Record<CadastroTipo, string> = {
  ASSISTENCIA: "Assistência",
  TROCA: "Troca",
  ERRO_ENTREGA: "Erro de entrega",
  ERRO_FATURAMENTO: "Erro de faturamento",
  MONTAGEM: "Montagem",
  HISTORICO: "Histórico (sem tipo na planilha original)",
  SAC: "SAC",
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
  SAC: "#0891B2",
};

export const CADASTRO_STATUSES = ["PROGRAMADO", "CONCLUIDO", "CANCELADO"] as const;
export type CadastroStatus = (typeof CADASTRO_STATUSES)[number];

// "Em processo" -- pedido do Victor 02/10/2026 ("altera programado para
// 'em processo'"). O valor interno continua "PROGRAMADO" (coluna `status`
// no banco, sem migration) -- só o rótulo exibido muda.
export const CADASTRO_STATUS_LABELS: Record<CadastroStatus, string> = {
  PROGRAMADO: "Em processo",
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
  cnpj: string | null;
  cliente: string | null;
  codigoCliente: string | null;
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
  cnpj: string | null;
  cliente: string | null;
  codigo_cliente: string | null;
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
  "id, tipo, tipo_original, codigo, produto, descricao, nf, vendedora, loja, cnpj, cliente, codigo_cliente, endereco, cpf, telefone, data_abertura, solicitante, prazo_data, prazo_calculado, prazo_nota, quem_montou, obs, status, origem_planilha";

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
    cnpj: row.cnpj,
    cliente: row.cliente,
    codigoCliente: row.codigo_cliente,
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

// Quem hoje está de fato com o caso (lança cadastro pelo sistema, toma as
// solicitações) -- pedido do Victor 02/10/2026, primeiro pro campo
// "Solicitante" do formulário (ver cadastroFormShared.tsx), depois pros
// cards "Equipe X" ("deixa apenas os que estão em atendimento, iasmyn,
// victor e michael"). Nomes antigos da planilha (Luisa, Mayara, Kelly,
// Lucas, Janielle etc.) continuam nos registros históricos -- só saem
// desses dois lugares específicos, não dos dados em si.
export const CADASTRO_SOLICITANTES_ATIVOS = ["Iasmyn", "Victor", "Michael"] as const;

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
  return [...byName.values()]
    .filter((r) => (CADASTRO_SOLICITANTES_ATIVOS as readonly string[]).includes(r.solicitante))
    .sort((a, b) => b.total - a.total);
}

export type NewCadastroInput = {
  tipo: CadastroTipo;
  codigo: string | null;
  produto: string;
  descricao: string | null;
  nf: string | null;
  vendedora: string | null;
  loja: string | null;
  cnpj: string | null;
  cliente: string;
  codigoCliente: string | null;
  endereco: string | null;
  cpf: string | null;
  telefone: string | null;
  dataAbertura: string | null;
  solicitante: string | null;
  // Prazo digitado no formulário -- null quando o atendente deixou em
  // branco, aí vira a mesma regra das linhas importadas (data_abertura +
  // 30 dias, prazo_calculado=true). Nunca vira prazo_nota aqui -- texto
  // livre ali só existe pra preservar o que já estava escrito na
  // planilha original, não faz sentido pra um cadastro novo.
  prazoData: string | null;
  quemMontou: string | null;
  obs: string | null;
};

// Lançar um cadastro novo direto pelo sistema -- pedido do Victor
// 01/10/2026, depois de aprovar o protótipo em Artifact (ver
// NovoCadastroDrawer.tsx). Mesma tabela das linhas importadas da planilha
// -- `origem_planilha` marca "Sistema" em vez do nome da aba, pra
// distinguir uma entrada nova de uma herdada da planilha, e `status`
// sempre nasce PROGRAMADO (acabou de ser aberto, não tem como já ter
// status diferente).
export async function addCadastroHistorico(input: NewCadastroInput): Promise<void> {
  const admin = getSupabaseAdmin();
  let prazoData = input.prazoData;
  let prazoCalculado = false;
  if (!prazoData && input.dataAbertura) {
    const d = new Date(`${input.dataAbertura}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 30);
    prazoData = d.toISOString().slice(0, 10);
    prazoCalculado = true;
  }

  const { error } = await admin.from("assistencia_cadastros_historico").insert({
    tipo: input.tipo,
    tipo_original: null,
    codigo: input.codigo,
    produto: input.produto,
    descricao: input.descricao,
    nf: input.nf,
    vendedora: input.vendedora,
    loja: input.loja,
    cnpj: input.cnpj,
    cliente: input.cliente,
    codigo_cliente: input.codigoCliente,
    endereco: input.endereco,
    cpf: input.cpf,
    telefone: input.telefone,
    data_abertura: input.dataAbertura,
    solicitante: input.solicitante,
    prazo_data: prazoData,
    prazo_calculado: prazoCalculado,
    prazo_nota: null,
    quem_montou: input.quemMontou,
    obs: input.obs,
    status: "PROGRAMADO",
    origem_planilha: "Sistema",
  });
  if (error) throw new Error(error.message);
}

export type UpdateCadastroInput = {
  tipo: CadastroTipo;
  codigo: string | null;
  produto: string;
  descricao: string | null;
  nf: string | null;
  vendedora: string | null;
  loja: string | null;
  cnpj: string | null;
  cliente: string;
  codigoCliente: string | null;
  endereco: string | null;
  cpf: string | null;
  telefone: string | null;
  dataAbertura: string | null;
  solicitante: string | null;
  // null (campo deixado em branco no formulário) == "não mexe no prazo" --
  // diferente de addCadastroHistorico (onde branco sempre vira data+30),
  // porque aqui já pode existir um prazo_nota de texto livre herdado da
  // planilha original (ex.: "peça chegou / volta p caixa") que não dá pra
  // reconstruir a partir de um <input type="date"> vazio. Só sobrescreve
  // quando a pessoa realmente digita uma data nova.
  prazoData: string | null;
  quemMontou: string | null;
  obs: string | null;
  status: CadastroStatus;
};

// Editar um cadastro existente (importado da planilha OU lançado pelo
// sistema) -- pedido do Victor 02/10/2026 ("preciso que haja um botão de
// editar nos cadastros que foram importados e nos próximos que foram
// cadastrados"). Mesmos campos de addCadastroHistorico, + status (só
// editar permite corrigir pra Concluído/Não concluído -- criar sempre
// nasce Programado).
export async function updateCadastroHistorico(id: string, input: UpdateCadastroInput): Promise<void> {
  const admin = getSupabaseAdmin();
  const update: Record<string, unknown> = {
    tipo: input.tipo,
    codigo: input.codigo,
    produto: input.produto,
    descricao: input.descricao,
    nf: input.nf,
    vendedora: input.vendedora,
    loja: input.loja,
    cnpj: input.cnpj,
    cliente: input.cliente,
    codigo_cliente: input.codigoCliente,
    endereco: input.endereco,
    cpf: input.cpf,
    telefone: input.telefone,
    data_abertura: input.dataAbertura,
    solicitante: input.solicitante,
    quem_montou: input.quemMontou,
    obs: input.obs,
    status: input.status,
  };
  if (input.prazoData) {
    update.prazo_data = input.prazoData;
    update.prazo_calculado = false;
    update.prazo_nota = null;
  }

  const { error } = await admin.from("assistencia_cadastros_historico").update(update).eq("id", id);
  if (error) throw new Error(error.message);
}
