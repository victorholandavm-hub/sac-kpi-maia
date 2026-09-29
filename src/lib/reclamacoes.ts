import { getSupabaseAdmin } from "./supabaseAdmin";
import { isStatusInternoResolvido } from "./reclamacoesLabels";

// Reclamações (Procon/Reclame Aqui/Judicial) -- ver migration
// 0140_reclamacoes.sql. Nasceu do histórico da planilha RECLAMAÇÕES.xlsx
// (35 casos, importados em 28/09/2026), mas diferente de `estornos.ts`
// (log manual puro), esta é cadastrável -- a planilha para de ser fonte de
// verdade a partir de agora, tudo daqui pra frente é criado/atualizado
// direto na tela (ver reclamacoes-actions.ts).

export type Reclamacao = {
  id: string;
  nome: string;
  cpf: string | null;
  orgao: string;
  dataRecebimento: string | null;
  statusInterno: string;
  statusExterno: string | null;
  dataAudiencia: string | null;
  documentos: string | null;
  recebidoPor: string | null;
  observacoes: string | null;
  createdAt: string;
  updatedAt: string;
};

const COLUMNS =
  "id, nome, cpf, orgao, data_recebimento, status_interno, status_externo, data_audiencia, documentos, recebido_por, observacoes, created_at, updated_at";

type Row = {
  id: string;
  nome: string;
  cpf: string | null;
  orgao: string;
  data_recebimento: string | null;
  status_interno: string;
  status_externo: string | null;
  data_audiencia: string | null;
  documentos: string | null;
  recebido_por: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
};

function toReclamacao(row: Row): Reclamacao {
  return {
    id: row.id,
    nome: row.nome,
    cpf: row.cpf,
    orgao: row.orgao,
    dataRecebimento: row.data_recebimento,
    statusInterno: row.status_interno,
    statusExterno: row.status_externo,
    dataAudiencia: row.data_audiencia,
    documentos: row.documentos,
    recebidoPor: row.recebido_por,
    observacoes: row.observacoes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listReclamacoes(): Promise<Reclamacao[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("reclamacoes").select(COLUMNS).order("created_at", { ascending: false }).returns<Row[]>();
  if (error) throw new Error(error.message);
  return (data ?? []).map(toReclamacao);
}

export async function getReclamacaoById(id: string): Promise<Reclamacao | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("reclamacoes").select(COLUMNS).eq("id", id).maybeSingle().returns<Row>();
  if (error) throw new Error(error.message);
  return data ? toReclamacao(data) : null;
}

export type ReclamacaoInput = {
  nome: string;
  cpf: string | null;
  orgao: string;
  dataRecebimento: string | null;
  statusInterno: string;
  statusExterno: string | null;
  dataAudiencia: string | null;
  documentos: string | null;
  recebidoPor: string | null;
  observacoes: string | null;
};

export async function createReclamacao(input: ReclamacaoInput): Promise<string> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("reclamacoes")
    .insert({
      nome: input.nome,
      cpf: input.cpf,
      orgao: input.orgao,
      data_recebimento: input.dataRecebimento,
      status_interno: input.statusInterno,
      status_externo: input.statusExterno,
      data_audiencia: input.dataAudiencia,
      documentos: input.documentos,
      recebido_por: input.recebidoPor,
      observacoes: input.observacoes,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function updateReclamacao(id: string, input: ReclamacaoInput): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("reclamacoes")
    .update({
      nome: input.nome,
      cpf: input.cpf,
      orgao: input.orgao,
      data_recebimento: input.dataRecebimento,
      status_interno: input.statusInterno,
      status_externo: input.statusExterno,
      data_audiencia: input.dataAudiencia,
      documentos: input.documentos,
      recebido_por: input.recebidoPor,
      observacoes: input.observacoes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export type ReclamacaoInlineField = "statusInterno" | "statusExterno" | "dataAudiencia";

const INLINE_FIELD_COLUMN: Record<ReclamacaoInlineField, string> = {
  statusInterno: "status_interno",
  statusExterno: "status_externo",
  dataAudiencia: "data_audiencia",
};

// Edição inline na tabela (pedido do Victor 29/09/2026) -- só os 3 campos
// que fazem sentido mudar direto na linha, sem abrir o formulário inteiro
// (ReclamacaoForm.tsx continua sendo o caminho pra editar o resto). Salva
// automático a cada troca, um campo por vez -- update() com uma coluna só
// evita reenviar (e sobrescrever com valor desatualizado) os outros campos
// que a linha nem mostra.
export async function patchReclamacaoField(id: string, field: ReclamacaoInlineField, value: string | null): Promise<void> {
  const admin = getSupabaseAdmin();
  const column = INLINE_FIELD_COLUMN[field];
  const { error } = await admin
    .from("reclamacoes")
    .update({ [column]: value, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export type ReclamacoesSummary = {
  total: number;
  emAberto: number;
  resolvidos: number;
  judiciais: number;
  porOrgao: { label: string; count: number }[];
  porStatus: { label: string; count: number }[];
};

// Resumo pro topo da tela -- mesmo espírito de getEstornoRequestsSummary.
// "Em aberto"/"Resolvido" aqui é só o status_interno (nosso controle
// próprio, ver reclamacoesLabels.ts) -- de propósito NÃO é o mesmo sinal
// de "próxima audiência" (ver listProximasAudiencias abaixo): alguns casos
// têm status_interno "Resolvido" mas ainda uma audiência futura marcada
// (ex.: aguardando guia de pagamento) -- por isso a tela mostra os dois
// separados, não junta num "aberto" só.
export function buildReclamacoesSummary(reclamacoes: Reclamacao[]): ReclamacoesSummary {
  const orgaoCounts = new Map<string, number>();
  const statusCounts = new Map<string, number>();
  let resolvidos = 0;
  let judiciais = 0;

  for (const r of reclamacoes) {
    orgaoCounts.set(r.orgao, (orgaoCounts.get(r.orgao) ?? 0) + 1);
    statusCounts.set(r.statusInterno, (statusCounts.get(r.statusInterno) ?? 0) + 1);
    if (isStatusInternoResolvido(r.statusInterno)) resolvidos++;
    if (r.orgao === "Judicial") judiciais++;
  }

  return {
    total: reclamacoes.length,
    emAberto: reclamacoes.length - resolvidos,
    resolvidos,
    judiciais,
    porOrgao: [...orgaoCounts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
    porStatus: [...statusCounts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
  };
}

// Próximas audiências -- o dado mais acionável da planilha original,
// independente do status_interno (ver comentário acima) -- ordenado por
// data, só as futuras (a partir de agora).
export function listProximasAudiencias(reclamacoes: Reclamacao[]): Reclamacao[] {
  const now = Date.now();
  return reclamacoes
    .filter((r) => r.dataAudiencia && new Date(r.dataAudiencia).getTime() >= now)
    .sort((a, b) => new Date(a.dataAudiencia!).getTime() - new Date(b.dataAudiencia!).getTime());
}
