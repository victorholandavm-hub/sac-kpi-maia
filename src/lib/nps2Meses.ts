import { getSupabaseAdmin } from "./supabaseAdmin";
import { isMostruarioRequest } from "./serviceRequests";
import { listClientesNaoContatar } from "./recompra";
import { RESOLVIDO_LABELS } from "./entregasRisco";
import { findGhlConversationId, fetchGhlMessages, type GhlConta } from "./ghlClient";
import { SUBCONTAS } from "./ghlSubcontas";
import { fetchInBatches } from "./supabaseBatch";
import { vendasDasEntregasResolvidas } from "./vendaDaEntrega";
import { enviarNpsPorPedido, pedidosComNps, type ResultadoEnvioNps } from "./npsEnvio";
import { NPS_GHL_TAG, NPS_1_5_PATTERN, sendNpsAutoReply, type NpsFaseResumo } from "./npsDetratores";

// Subconta do disparo -- mesmo mecanismo de vendaNps.ts (0194/21-10-2026):
// COMPRA_NPS_SUBCONTA=lojas_maia liga; sem a variável continua pelo SAC. Na
// Lojas Maia o Workflow "NPS Pós 20 dias" reage à tag nova (TAG_LOJAS_MAIA_COMPRA,
// com acento, exatamente como o Victor cadastrou no GHL em 22/10/2026 --
// não é "gatilho-nps-compra", que é a tag do workflow que já roda no SAC).
const TAG_LOJAS_MAIA_COMPRA = "nps-pós-20dias";

function contaLojasMaiaCompra(): GhlConta {
  return { token: process.env[SUBCONTAS.lojas_maia.tokenEnv], locationId: SUBCONTAS.lojas_maia.locationId };
}

function disparoCompra(): { conta?: GhlConta; tag: string } {
  return process.env.COMPRA_NPS_SUBCONTA === "lojas_maia"
    ? { conta: contaLojasMaiaCompra(), tag: TAG_LOJAS_MAIA_COMPRA }
    : { tag: NPS_GHL_TAG.compra! };
}

// NPS "20 dias pós-recebimento" -- pedido do Victor 09/09/2026: "Cliente so
// pode receber uma a cada 90 dias. Gatilho é a data de entrega, e coloque 2
// meses apos o recebimento e nao um [mês]". Janela encurtada de 2 meses (60
// dias) pra 20 dias em 28/09/2026, mesmo pedido do Victor -- o nome
// interno da tabela (compra_nps) e da origem ("compra", ver
// npsDetratores.ts) ficaram como estavam, só o rótulo visível e
// TARGET_DAYS_AGO abaixo mudaram; o limite de 90 dias por cliente (linha
// acima) continua igual, não tem relação com o gatilho de dias. Diferente
// de montagem/assistência técnica (service_request_nps, um chamado de
// assistência por trás): esse é por PEDIDO de venda (totvs_orders), sem
// chamado nenhum envolvido -- mesmo espírito de "Pós-entrega"
// (entregaNps.ts, tabela própria pelo mesmo motivo), só com uma janela
// mais larga.
//
// Volume bem maior que os outros 3 juntos (~7.600 pedidos/mês contra ~450)
// -- por isso o limite de 90 dias por cliente (não manda de novo pra quem
// compra toda semana) e um teto por rodada (MAX_ENROLL_PER_RUN abaixo),
// pra não fazer o /api/sync demorar mais do que já demora (ver o histórico
// de timeout do Nginx, corrigido 08/09/2026 -- não é pra repetir).
// 150 por rodada desde 21/10/2026 (pedido do Victor: API oficial do
// WhatsApp, sem risco de bloqueio por volume; o que limita é o nível de
// mensagens/24h da conta na Meta). Era 50.
const MAX_ENROLL_PER_RUN = 150;
// Teto próprio pro backfill de cadastro, menor que MAX_ENROLL_PER_RUN --
// mesmo racional de entregaNps.ts: cada código faltante é uma chamada de
// verdade ao Protheus, e essa função já compete pelo mesmo orçamento de
// tempo do /api/sync que as outras 3 pesquisas de NPS (--max-time 290, ver
// sync-cron.yml). O resto dos códigos sem cadastro fica pra próxima rodada.
const BACKFILL_MAX_CODES_PER_RUN = 20;

// Janela de 7 dias (não só "exatamente 60 dias atrás") -- absorve o sync
// ficando fora do ar por alguns dias sem perder ninguém que devia ter
// entrado na janela nesse meio tempo. Mesmo espírito do "catch up" que a
// task agendada do totvs-sync já tem (StartWhenAvailable).
const WINDOW_DAYS = 7;
const TARGET_DAYS_AGO = 20;

type OrderRow = { id: string; invoice: string | null; serie: string | null; client_id: string | null; client_name: string | null };

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export async function enrollPendingCompraNps(): Promise<ResultadoEnvioNps> {
  const admin = getSupabaseAdmin();

  // 1. Cargas entregues (de verdade, não "Cancelada"/"Em rota") há ~2
  // meses -- mesmo critério de resolvido que entregasRisco.ts/recompra.ts
  // já usam.
  const fromDate = isoDaysAgo(TARGET_DAYS_AGO + WINDOW_DAYS);
  const toDate = isoDaysAgo(TARGET_DAYS_AGO);

  // 2. Venda de cada entrega pelo cliente + filial + produtos (0200) -- não
  // mais pela nota fiscal da carga, que é a de remessa do CD e casava com a
  // venda de outro cliente (ver vendaDaEntrega.ts).
  let candidates: OrderRow[];
  try {
    candidates = (await vendasDasEntregasResolvidas(admin, fromDate, toDate, RESOLVIDO_LABELS)).filter((o) => o.client_id);
  } catch (err) {
    return { enrolled: 0, semTelefone: 0, errors: [`compra-nps vendas: ${(err as Error).message}`], avisos: [] };
  }
  if (candidates.length === 0) return { enrolled: 0, semTelefone: 0, errors: [], avisos: [] };

  // 3. Já enviado pra esse pedido? Já opt-out desse cliente (mesma lista
  // do Motor de Recompra, "legítimo interesse" pede opção de saída)?
  let alreadySent: Set<string>;
  try {
    alreadySent = await pedidosComNps(admin, "compra_nps", candidates.map((c) => c.id));
  } catch (err) {
    return { enrolled: 0, semTelefone: 0, errors: [`compra-nps já enviados: ${(err as Error).message}`], avisos: [] };
  }
  const naoContatar = await listClientesNaoContatar();

  let eligible = candidates.filter(
    (c) => !alreadySent.has(c.id) && !naoContatar.has(c.client_id as string) && !isMostruarioRequest(c.invoice, c.client_name)
  );
  if (eligible.length === 0) return { enrolled: 0, semTelefone: 0, errors: [], avisos: [] };

  // 4. Um cliente pode ter mais de um pedido entregue na mesma janela --
  // só uma pesquisa por cliente por rodada (o limite de 90 dias abaixo
  // cobre o resto). Fica com a entrega mais antiga da janela.
  const firstPerClient = new Map<string, OrderRow>();
  for (const c of eligible) {
    const key = c.client_id as string;
    if (!firstPerClient.has(key)) firstPerClient.set(key, c);
  }
  eligible = [...firstPerClient.values()];

  // 5. Limite de 90 dias por cliente (pedido do Victor 09/09/2026) -- olha
  // TODAS as pesquisas já mandadas desse cliente (qualquer pedido), não só
  // a desse pedido específico.
  const sinceIso = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  let recentSends: { client_id: string }[];
  try {
    recentSends = await fetchInBatches<{ client_id: string }>(
      eligible.map((c) => c.client_id as string),
      (lote) => admin.from("compra_nps").select("client_id").in("client_id", lote).gte("enviado_em", sinceIso)
    );
  } catch (err) {
    return { enrolled: 0, semTelefone: 0, errors: [`compra-nps últimos 90 dias: ${(err as Error).message}`], avisos: [] };
  }
  const recentlyContacted = new Set(recentSends.map((r) => r.client_id));
  eligible = eligible.filter((c) => !recentlyContacted.has(c.client_id as string));
  if (eligible.length === 0) return { enrolled: 0, semTelefone: 0, errors: [], avisos: [] };

  // 6. Telefone -- totvs_orders não tem, precisa do cadastro (mesmo join
  // client_id = protheus_code que o resto do projeto já usa, ver
  // clientes.ts). `totvs_clientes` só cobre uma fração de quem já comprou
  // (mesmo gap documentado em totvsLookup.ts/findTotvsClientByCode),
  // diferente de montagem/assistência técnica (telefone vem direto do
  // chamado). Backfill reativo (achado do Victor 26/09/2026: a listagem em
  // massa do Protheus não traz vários clientes reais, mas SearchQuery por
  // código funciona) antes de checar telefone; quem segue sem telefone
  // conta em `semTelefone` (limite de dado conhecido, não erro) e é pulado
  // sem ocupar vaga (ver npsEnvio.ts).
  const disparo = disparoCompra();
  return enviarNpsPorPedido(admin, {
    tabela: "compra_nps",
    tag: disparo.tag,
    conta: disparo.conta,
    rotulo: "compra-nps",
    candidatos: eligible,
    maxEnvios: MAX_ENROLL_PER_RUN,
    maxBackfill: BACKFILL_MAX_CODES_PER_RUN,
  });
}

export async function detectPendingCompraNpsResponses(): Promise<number> {
  const admin = getSupabaseAdmin();
  const { data: pending } = await admin
    .from("compra_nps")
    .select("order_id, ghl_contact_id, enviado_em, ghl_location_id")
    .is("respondido_em", null)
    .is("descartada_em", null)
    // As mais recentes primeiro (ver vendaNps.ts): sem ordem, as 100 primeiras
    // pendentes eram sempre as mesmas e as novas não eram lidas.
    .gte("enviado_em", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order("enviado_em", { ascending: false })
    .limit(200);
  if (!pending || pending.length === 0) return 0;

  let answered = 0;
  for (const row of pending) {
    // Linha sem ghl_location_id foi enviada pelo SAC (antes da subconta Lojas Maia).
    const conta = row.ghl_location_id === SUBCONTAS.lojas_maia.locationId ? contaLojasMaiaCompra() : undefined;
    const conversationId = await findGhlConversationId(row.ghl_contact_id, conta);
    if (!conversationId) continue;
    const msgs = await fetchGhlMessages(conversationId, conta?.token);
    if (!msgs) continue;
    const sentAtMs = new Date(row.enviado_em).getTime();
    const reply = msgs.find(
      (m) => m.direction === "inbound" && new Date(m.dateAdded).getTime() > sentAtMs && NPS_1_5_PATTERN.test((m.body ?? "").trim())
    );
    if (!reply) continue;
    const score = Number(NPS_1_5_PATTERN.exec(reply.body!.trim())![1]);
    await admin.from("compra_nps").update({ score, respondido_em: reply.dateAdded }).eq("order_id", row.order_id);
    await sendNpsAutoReply(row.ghl_contact_id, score, conta);
    answered++;
  }
  return answered;
}

// Resumo (NPS clássico: %promotores - %detratores, adaptado pra escala 1-5
// -- promotor 4-5, detrator 1-2, mesmo critério de buildNpsSummary/kpi.ts)
// pro card "20 dias pós-recebimento" do Resumo de /avaliacoes -- mesmo
// formato de getNpsResumoPorFaseAdicional (npsDetratores.ts), função
// própria porque compra_nps é tabela separada (sem chamado de assistência
// por trás).
// sentCount vem de uma query à parte com `count: "exact", head: true` --
// compra_nps já passa de 1000 linhas fácil (volume bem maior que as
// outras fases), um `.select()` normal sem `.range()` cortaria o total
// em silêncio no limite padrão do PostgREST (mesmo gotcha corrigido em
// totvsSync.ts/backfillMissingClients, 19/10/2026).
export async function getCompraNpsResumo(): Promise<NpsFaseResumo> {
  const admin = getSupabaseAdmin();
  const [
    { data, error },
    { count: sentCount, error: sentError },
  ] = await Promise.all([
    // descartadas (0201): enviadas pra pessoa errada até 26/10/2026, não contam
    admin.from("compra_nps").select("score").is("descartada_em", null).not("score", "is", null),
    admin.from("compra_nps").select("order_id", { count: "exact", head: true }).is("descartada_em", null),
  ]);
  if (error) throw new Error(error.message);
  if (sentError) throw new Error(sentError.message);

  const scores = (data ?? []).map((r) => r.score as number);
  const sent = sentCount ?? 0;
  const responseRatePct = sent > 0 ? Math.round((scores.length / sent) * 100) : null;
  if (scores.length === 0) return { npsIndex: null, responseCount: 0, sentCount: sent, responseRatePct };
  const promoters = scores.filter((s) => s >= 4).length;
  const detractors = scores.filter((s) => s <= 2).length;
  const npsIndex = Math.round(((promoters - detractors) / scores.length) * 100);
  return { npsIndex, responseCount: scores.length, sentCount: sent, responseRatePct };
}
