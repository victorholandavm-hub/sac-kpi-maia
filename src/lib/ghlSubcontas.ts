import { getSupabaseAdmin } from "./supabaseAdmin";
import { businessMinutesBetween } from "./businessHours";
import { fetchGhlMessages, isHumanReply } from "./ghlClient";
import { fetchAllPagesParallel, type PagedQueryResult } from "./supabasePagination";

const BASE_URL = "https://services.leadconnectorhq.com";
const JANELA_DIAS = 60;
const MAX_MENSAGENS_POR_RODADA = 150;

export const SUBCONTAS = {
  lojas_maia: { label: "GHL Lojas Maia", locationId: "oODW71MWRSzUFTdVpDkw", tokenEnv: "GHL_TOKEN_LOJAS_MAIA" },
  lider: { label: "GHL Líder", locationId: "nhY2F8f9xm62fWGyygkB", tokenEnv: "GHL_TOKEN_LIDER" },
} as const;
export type SubcontaKey = keyof typeof SUBCONTAS;

// Usuários do GHL da equipe do SAC -- os mesmos IDs nas duas subcontas.
export const ATENDENTES_SAC = [
  { userId: "4AT1aeLX9kpb6fMIxAke", nome: "Iasmyn" },
  { userId: "ngAqBWqJNwJPf61hvTQv", nome: "Alynne" },
  { userId: "H1ryVdEQfvAElbeAY8Ja", nome: "Ingrid" },
  { userId: "blYazFr93qhqPkJCdEe6", nome: "Flávio" },
  { userId: "1i5IiTAIAdWfixI3nTI4", nome: "Jaluska" },
] as const;

type ConversaGhl = {
  id: string;
  dateAdded?: number;
  lastMessageDate?: number;
  dateUpdated?: number;
  sort?: number[];
};

function ghlHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, Version: "2021-07-28", Accept: "application/json" };
}

// Conversas atribuídas a um atendente, com atividade dentro da janela.
async function listarConversasDoAtendente(locationId: string, token: string, userId: string, sinceMs: number): Promise<ConversaGhl[]> {
  const conversas: ConversaGhl[] = [];
  let startAfterDate: number | undefined;
  for (let page = 0; page < 30; page++) {
    const params = new URLSearchParams({ locationId, assignedTo: userId, limit: "100" });
    if (startAfterDate) params.set("startAfterDate", String(startAfterDate));
    const res = await fetch(`${BASE_URL}/conversations/search?${params}`, { headers: ghlHeaders(token) });
    if (!res.ok) throw new Error(`conversations/search (${userId}) página ${page}: ${res.status}`);
    const batch: ConversaGhl[] = (await res.json()).conversations ?? [];
    if (batch.length === 0) break;
    conversas.push(...batch);
    const mais_antiga = batch[batch.length - 1];
    if ((mais_antiga.lastMessageDate ?? mais_antiga.dateUpdated ?? 0) < sinceMs) break;
    const sortValues = batch.map((c) => c.sort?.[0]).filter((v): v is number => typeof v === "number");
    if (sortValues.length === 0 || batch.length < 100) break;
    startAfterDate = Math.min(...sortValues);
  }
  return conversas.filter((c) => (c.lastMessageDate ?? c.dateUpdated ?? 0) >= sinceMs);
}

// Tempo até a primeira resposta do PRÓPRIO atendente, em minutos úteis.
// Mensagem automática de recepção não conta (ver isHumanReply).
function primeiraRespostaMinutos(msgs: Awaited<ReturnType<typeof fetchGhlMessages>>, userId: string): number | null {
  if (!msgs) return null;
  const entrada = msgs.find((m) => m.direction === "inbound");
  if (!entrada) return null;
  const resposta = msgs.find(
    (m) => m.direction === "outbound" && m.dateAdded > entrada.dateAdded && isHumanReply(m) && m.userId === userId
  );
  if (!resposta) return null;
  const minutos = businessMinutesBetween(new Date(entrada.dateAdded), new Date(resposta.dateAdded));
  return Math.round(minutos * 10) / 10;
}

export type ResultadoSyncSubconta = {
  conversasEncontradas: number;
  novas: number;
  mensagensLidas: number;
  pendentesRestantes: number;
};

// Sincroniza uma subconta. Idempotente: uma conversa vira uma linha só
// (upsert por ghl_conversation_id). Conversas ainda sem resposta são
// reconsultadas nas rodadas seguintes, limitado a MAX_MENSAGENS_POR_RODADA
// chamadas por execução pra não estourar o tempo do cron.
export async function sincronizarSubconta(key: SubcontaKey): Promise<ResultadoSyncSubconta> {
  const sub = SUBCONTAS[key];
  const token = process.env[sub.tokenEnv];
  if (!token) throw new Error(`${sub.tokenEnv} não configurada na VPS`);

  const admin = getSupabaseAdmin();
  const sinceMs = Date.now() - JANELA_DIAS * 24 * 60 * 60 * 1000;

  const conhecidas = await fetchAllPagesParallel<{ ghl_conversation_id: string; primeira_resposta_min: number | null }>(
    (from, to) =>
      admin
        .from("ghl_atendimentos")
        .select("ghl_conversation_id, primeira_resposta_min", { count: "exact" })
        .eq("subconta", key)
        .gte("aberta_em", new Date(sinceMs).toISOString())
        .range(from, to) as unknown as PromiseLike<PagedQueryResult<{ ghl_conversation_id: string; primeira_resposta_min: number | null }>>
  );
  const estado = new Map(conhecidas.map((r) => [r.ghl_conversation_id, r.primeira_resposta_min]));

  const todas: { conversa: ConversaGhl; userId: string; nome: string }[] = [];
  for (const atendente of ATENDENTES_SAC) {
    const lista = await listarConversasDoAtendente(sub.locationId, token, atendente.userId, sinceMs);
    for (const conversa of lista) todas.push({ conversa, userId: atendente.userId, nome: atendente.nome });
  }

  // Prioriza conversas novas, depois as que ainda não têm resposta registrada.
  const ordem = todas
    .filter(({ conversa }) => !estado.has(conversa.id) || estado.get(conversa.id) === null)
    .sort((a, b) => (estado.has(a.conversa.id) ? 1 : 0) - (estado.has(b.conversa.id) ? 1 : 0));

  let mensagensLidas = 0;
  let novas = 0;
  const agora = new Date().toISOString();
  for (const { conversa, userId, nome } of ordem) {
    if (mensagensLidas >= MAX_MENSAGENS_POR_RODADA) break;
    const msgs = await fetchGhlMessages(conversa.id, token);
    mensagensLidas++;
    if (!estado.has(conversa.id)) novas++;
    const minutos = primeiraRespostaMinutos(msgs, userId);
    const { error } = await admin.from("ghl_atendimentos").upsert(
      {
        subconta: key,
        ghl_conversation_id: conversa.id,
        atendente_user_id: userId,
        atendente_nome: nome,
        aberta_em: new Date(conversa.dateAdded ?? Date.now()).toISOString(),
        primeira_resposta_min: minutos,
        atualizado_em: agora,
      },
      { onConflict: "ghl_conversation_id" }
    );
    if (error) throw new Error(error.message);
  }

  const pendentesRestantes = ordem.length - mensagensLidas;
  return { conversasEncontradas: todas.length, novas, mensagensLidas, pendentesRestantes: Math.max(0, pendentesRestantes) };
}

export type ResumoAtendente = {
  nome: string;
  conversas: number;
  respondidas: number;
  tempoMedioMin: number | null;
};

// Resumo da janela (60 dias) por atendente, pra tela de KPIs.
export async function resumoAtendimentos(key: SubcontaKey): Promise<{ porAtendente: ResumoAtendente[]; atualizadoEm: string | null }> {
  const admin = getSupabaseAdmin();
  const sinceIso = new Date(Date.now() - JANELA_DIAS * 24 * 60 * 60 * 1000).toISOString();
  const linhas = await fetchAllPagesParallel<{ atendente_nome: string; primeira_resposta_min: number | null; atualizado_em: string }>(
    (from, to) =>
      admin
        .from("ghl_atendimentos")
        .select("atendente_nome, primeira_resposta_min, atualizado_em", { count: "exact" })
        .eq("subconta", key)
        .gte("aberta_em", sinceIso)
        .range(from, to) as unknown as PromiseLike<PagedQueryResult<{ atendente_nome: string; primeira_resposta_min: number | null; atualizado_em: string }>>
  );

  const porNome = new Map<string, { conversas: number; respondidas: number; soma: number }>();
  let atualizadoEm: string | null = null;
  for (const l of linhas) {
    const acc = porNome.get(l.atendente_nome) ?? { conversas: 0, respondidas: 0, soma: 0 };
    acc.conversas++;
    if (l.primeira_resposta_min !== null) {
      acc.respondidas++;
      acc.soma += Number(l.primeira_resposta_min);
    }
    porNome.set(l.atendente_nome, acc);
    if (!atualizadoEm || l.atualizado_em > atualizadoEm) atualizadoEm = l.atualizado_em;
  }

  const porAtendente = ATENDENTES_SAC.map((a) => {
    const acc = porNome.get(a.nome) ?? { conversas: 0, respondidas: 0, soma: 0 };
    return {
      nome: a.nome,
      conversas: acc.conversas,
      respondidas: acc.respondidas,
      tempoMedioMin: acc.respondidas > 0 ? Math.round((acc.soma / acc.respondidas) * 10) / 10 : null,
    };
  });
  return { porAtendente, atualizadoEm };
}
