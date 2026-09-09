import { getSupabaseAdmin } from "./supabaseAdmin";

// Lista de trabalho unificada de detratores -- pedido do Victor 08/09/2026:
// nome/contato/motivo de todo mundo que deu nota baixa em QUALQUER NPS que
// o sistema roda, não só o do SAC. Duas escalas diferentes coexistem de
// propósito (não convertidas pra uma "nota única"): SAC usa 1-5 (detrator =
// 1 ou 2, mesmo critério de NpsDetractor em kpi.ts) e montagem/assistência
// técnica/entrega usam 0-10, o NPS de verdade (detrator = 0 a 6, padrão de
// mercado). "1 mês pós-recebimento" entra aqui quando existir -- é só somar
// mais uma origem no union abaixo.
export const NPS_DETRATOR_ORIGENS = ["sac", "montagem", "assistencia_tecnica", "entrega"] as const;
export type NpsDetratorOrigem = (typeof NPS_DETRATOR_ORIGENS)[number];

export const NPS_DETRATOR_ORIGEM_LABELS: Record<NpsDetratorOrigem, string> = {
  sac: "Atendimento (SAC)",
  montagem: "Pós-montagem",
  assistencia_tecnica: "Pós-assistência técnica",
  entrega: "Pós-entrega",
};

// Taxonomia de recuperação de detrator -- padrão de "closed-loop feedback"
// usado em CX de varejo (contatar -> tentar reverter -> registrar
// resultado), pedido do Victor 08/09/2026: "algo que o mercado de varejo
// usa". "sem_resposta" separado de "perdido" de propósito -- são coisas
// diferentes pra decidir o próximo passo (sem_resposta pode valer tentar
// de novo; perdido é uma decisão já tomada).
export const NPS_DETRATOR_STATUSES = ["nao_contatado", "em_contato", "recuperado", "perdido", "sem_resposta"] as const;
export type NpsDetratorStatus = (typeof NPS_DETRATOR_STATUSES)[number];

export const NPS_DETRATOR_STATUS_LABELS: Record<NpsDetratorStatus, string> = {
  nao_contatado: "Não contatado",
  em_contato: "Em contato",
  recuperado: "Recuperado",
  perdido: "Perdido",
  sem_resposta: "Sem resposta",
};

export const NPS_DETRATOR_STATUS_COLORS: Record<NpsDetratorStatus, string> = {
  nao_contatado: "var(--status-critical)",
  em_contato: "var(--status-warning)",
  recuperado: "var(--status-good)",
  perdido: "var(--text-muted)",
  sem_resposta: "var(--status-serious)",
};

export function isNpsDetratorStatus(value: string): value is NpsDetratorStatus {
  return (NPS_DETRATOR_STATUSES as readonly string[]).includes(value);
}

export type NpsDetrator = {
  origem: NpsDetratorOrigem;
  origemId: string;
  score: number;
  escala: "1-5" | "0-10";
  respondidoEm: string;
  clientName: string | null;
  clientPhone: string | null;
  status: NpsDetratorStatus;
  motivo: string | null;
  atualizadoEm: string | null;
  // Resumo automático da conversa do GHL (v_ticket_enriched.summary_ai) --
  // pedido do Victor 08/09/2026: "você que tem que me trazer qual foi o
  // motivo, pois tem dentro da conversa do GHL". Só existe pra origem "sac"
  // (é a única com conversa de atendimento de verdade por trás -- montagem/
  // assistência técnica respondem a pesquisa avulsa, sem esse resumo).
  // Preenche o campo Motivo como sugestão editável, nunca sobrescreve um
  // motivo que o time já registrou.
  motivoSugerido: string | null;
};

type StatusRow = { origem: string; origem_id: string; status: string; motivo: string | null; atualizado_em: string };

// Só os últimos 6 meses -- lista de trabalho ("quem eu preciso ligar"), não
// relatório histórico; sem esse corte só cresceria pra sempre.
const LOOKBACK_MS = 180 * 24 * 60 * 60 * 1000;

export async function listNpsDetratores(): Promise<NpsDetrator[]> {
  const admin = getSupabaseAdmin();
  const sinceIso = new Date(Date.now() - LOOKBACK_MS).toISOString();

  const [{ data: sacRows, error: sacError }, { data: reqRows, error: reqError }, { data: statusRows, error: statusError }] = await Promise.all([
    admin
      .from("conversations")
      .select("id, nps_score, nps_answered_at, contact_id")
      .not("nps_score", "is", null)
      .lte("nps_score", 2)
      .gte("nps_answered_at", sinceIso)
      .order("nps_answered_at", { ascending: false }),
    admin
      .from("service_request_nps")
      .select("request_id, tipo, score, respondido_em, service_requests(client_name, client_phone)")
      .not("score", "is", null)
      .lte("score", 6)
      .gte("respondido_em", sinceIso)
      .order("respondido_em", { ascending: false }),
    admin.from("nps_detrator_status").select("origem, origem_id, status, motivo, atualizado_em"),
  ]);
  if (sacError) throw new Error(sacError.message);
  if (reqError) throw new Error(reqError.message);
  if (statusError) throw new Error(statusError.message);

  const statusByKey = new Map((statusRows as StatusRow[] | null ?? []).map((r) => [`${r.origem}:${r.origem_id}`, r]));
  function resolveStatus(origem: NpsDetratorOrigem, origemId: string): { status: NpsDetratorStatus; motivo: string | null; atualizadoEm: string | null } {
    const row = statusByKey.get(`${origem}:${origemId}`);
    const status = row && isNpsDetratorStatus(row.status) ? row.status : "nao_contatado";
    return { status, motivo: row?.motivo ?? null, atualizadoEm: row?.atualizado_em ?? null };
  }

  const contactIds = [...new Set((sacRows ?? []).map((r) => r.contact_id).filter((id): id is string => !!id))];
  const contactsById = new Map<string, { name: string | null; phone: string | null }>();
  if (contactIds.length > 0) {
    const { data: contactRows, error: contactsError } = await admin.from("contacts").select("id, name, phone").in("id", contactIds);
    if (contactsError) throw new Error(contactsError.message);
    for (const c of contactRows ?? []) contactsById.set(c.id, { name: c.name, phone: c.phone });
  }

  // Resumo automático da conversa (ver comentário no tipo NpsDetrator acima)
  // -- v_ticket_enriched não tem linha pra toda conversa (só quem já foi
  // classificado, ver sync-ai-classify), então nem todo detrator do SAC vai
  // ter sugestão; sem sugestão o campo fica em branco pro time preencher à
  // mão mesmo, sem quebrar nada.
  const sacConversationIds = (sacRows ?? []).map((r) => r.id as string);
  const summaryByConversationId = new Map<string, string | null>();
  if (sacConversationIds.length > 0) {
    const { data: summaryRows, error: summaryError } = await admin
      .from("v_ticket_enriched")
      .select("conversation_id, summary_ai")
      .in("conversation_id", sacConversationIds);
    if (summaryError) throw new Error(summaryError.message);
    for (const s of summaryRows ?? []) summaryByConversationId.set(s.conversation_id as string, s.summary_ai as string | null);
  }

  const sac: NpsDetrator[] = (sacRows ?? [])
    .filter((r) => r.nps_answered_at)
    .map((r) => {
      const contact = r.contact_id ? contactsById.get(r.contact_id) : null;
      const resolved = resolveStatus("sac", r.id);
      return {
        origem: "sac" as const,
        origemId: r.id as string,
        score: r.nps_score as number,
        escala: "1-5" as const,
        respondidoEm: r.nps_answered_at as string,
        clientName: contact?.name ?? null,
        clientPhone: contact?.phone ?? null,
        motivoSugerido: summaryByConversationId.get(r.id as string) ?? null,
        ...resolved,
      };
    });

  type ReqRow = {
    request_id: string;
    tipo: string;
    score: number;
    respondido_em: string;
    service_requests: { client_name: string | null; client_phone: string | null } | { client_name: string | null; client_phone: string | null }[] | null;
  };
  const req: NpsDetrator[] = ((reqRows ?? []) as unknown as ReqRow[]).map((r) => {
    const sr = Array.isArray(r.service_requests) ? r.service_requests[0] : r.service_requests;
    const origem = (r.tipo === "montagem" || r.tipo === "entrega" ? r.tipo : "assistencia_tecnica") as NpsDetratorOrigem;
    const resolved = resolveStatus(origem, r.request_id);
    return {
      origem,
      origemId: r.request_id,
      score: r.score,
      escala: "0-10" as const,
      respondidoEm: r.respondido_em,
      clientName: sr?.client_name ?? null,
      clientPhone: sr?.client_phone ?? null,
      motivoSugerido: null,
      ...resolved,
    };
  });

  return [...sac, ...req].sort((a, b) => b.respondidoEm.localeCompare(a.respondidoEm));
}

export type NpsFaseResumo = { npsIndex: number | null; responseCount: number };

// Resumo (NPS clássico: %promotores - %detratores) pras fases que ainda não
// têm uma função de summary própria feito nem_summary.ts tem pro SAC --
// pedido do Victor 08/09/2026: "a primeira aba [de /avaliacoes] seja
// desse resumo de avaliações de todas as fases". Devolve responseCount:0 +
// npsIndex:null quando não tem nenhuma resposta ainda (vira "—" na tela) --
// não precisa de código novo quando montagem/assistência técnica
// começarem a responder de verdade, já calcula sozinho.
export async function getNpsResumoPorFaseAdicional(): Promise<Record<"montagem" | "assistencia_tecnica" | "entrega", NpsFaseResumo>> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("service_request_nps").select("tipo, score").not("score", "is", null);
  if (error) throw new Error(error.message);

  function resumoFor(tipo: "montagem" | "assistencia_tecnica" | "entrega"): NpsFaseResumo {
    const scores = (data ?? []).filter((r) => r.tipo === tipo).map((r) => r.score as number);
    if (scores.length === 0) return { npsIndex: null, responseCount: 0 };
    const promoters = scores.filter((s) => s >= 9).length;
    const detractors = scores.filter((s) => s <= 6).length;
    const npsIndex = Math.round(((promoters - detractors) / scores.length) * 100);
    return { npsIndex, responseCount: scores.length };
  }

  return { montagem: resumoFor("montagem"), assistencia_tecnica: resumoFor("assistencia_tecnica"), entrega: resumoFor("entrega") };
}

export async function registrarStatusDetrator(
  origem: NpsDetratorOrigem,
  origemId: string,
  opts: { status: NpsDetratorStatus; motivo: string | null }
): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("nps_detrator_status").upsert(
    {
      origem,
      origem_id: origemId,
      status: opts.status,
      motivo: opts.motivo,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: "origem,origem_id" }
  );
  if (error) throw new Error(error.message);
}
