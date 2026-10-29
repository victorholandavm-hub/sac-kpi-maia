import { getSupabaseAdmin } from "./supabaseAdmin";
import { isMostruarioRequest } from "./serviceRequests";
import { listClientesNaoContatar } from "./recompra";
import { RESOLVIDO_LABELS } from "./entregasRisco";
import { findGhlConversationId, fetchGhlMessages, sendGhlMessage } from "./ghlClient";
import { vendasDasEntregasResolvidas } from "./vendaDaEntrega";
import { enviarNpsPorPedido, pedidosComNps, type ResultadoEnvioNps } from "./npsEnvio";
import { NPS_GHL_TAG, NPS_1_5_PATTERN } from "./npsDetratores";
import { maybeRequestGoogleReview } from "./googleReviewRequest";
import { encaminharPelaNota } from "./npsEncaminhar";

// NPS "Pós-entrega" -- pedido do Victor 22/09/2026: pergunta sobre a
// entrega ORIGINAL da compra (o caminhão leva o móvel pela primeira vez),
// não um chamado de assistência -- mesmo mecanismo de "20 dias
// pós-recebimento" (nps2Meses.ts/compra_nps, TARGET_DAYS_AGO=20 desde
// 28/09/2026), copiado quase igual daqui (mesma fonte
// totvs_delivery_cargas/totvs_orders, mesmo cruzamento por nota fiscal +
// série), só com uma janela bem mais curta -- pergunta logo depois da
// entrega, não semanas depois. Sem o limite de 90 dias por
// cliente que a Compra tem (pergunta diferente, sobre uma entrega
// específica, não sobre a experiência geral -- um cliente com 2 entregas
// na mesma semana pode legitimamente receber as duas pesquisas).
// 150 por rodada desde 21/10/2026 (pedido do Victor: API oficial do
// WhatsApp, sem risco de bloqueio por volume; o que limita é o nível de
// mensagens/24h da conta na Meta). Era 50.
const MAX_ENROLL_PER_RUN = 150;
// Teto próprio pro backfill de cadastro (menor que MAX_ENROLL_PER_RUN) --
// cada código faltante custa uma chamada de verdade ao Protheus (SearchQuery),
// e /api/sync já reúne as 4 pesquisas de NPS numa chamada só, com um
// orçamento de tempo apertado (ver .github/workflows/sync-cron.yml,
// --max-time 290). 20 é conservador o bastante pra não estourar isso
// sozinho -- o resto dos códigos sem cadastro fica pra próxima rodada.
const BACKFILL_MAX_CODES_PER_RUN = 20;

// 1-2 dias depois da entrega -- dá tempo do cliente abrir a caixa/montar
// antes de perguntar, mas ainda perto o bastante da experiência pra
// lembrar dos detalhes. Ajustável se o Victor achar cedo/tarde demais
// depois de ver os números reais.
const WINDOW_DAYS = 1;
const TARGET_DAYS_AGO = 1;

type OrderRow = { id: string; invoice: string | null; serie: string | null; client_id: string | null; client_name: string | null };

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export async function enrollPendingEntregaNps(): Promise<ResultadoEnvioNps> {
  const admin = getSupabaseAdmin();

  // 1. Cargas entregues (de verdade, não "Cancelada"/"Em rota") na janela
  // curta -- mesmo critério de resolvido que entregasRisco.ts/recompra.ts/
  // nps2Meses.ts já usam.
  const fromDate = isoDaysAgo(TARGET_DAYS_AGO + WINDOW_DAYS);
  const toDate = isoDaysAgo(TARGET_DAYS_AGO);

  // 2. Venda de cada entrega pelo cliente + filial + produtos (0200) -- não
  // mais pela nota fiscal da carga, que é a de remessa do CD e casava com a
  // venda de outro cliente (ver vendaDaEntrega.ts).
  let candidates: OrderRow[];
  try {
    candidates = (await vendasDasEntregasResolvidas(admin, fromDate, toDate, RESOLVIDO_LABELS)).filter((o) => o.client_id);
  } catch (err) {
    return { enrolled: 0, semTelefone: 0, errors: [`entrega-nps vendas: ${(err as Error).message}`], avisos: [] };
  }
  if (candidates.length === 0) return { enrolled: 0, semTelefone: 0, errors: [], avisos: [] };

  // 3. Já enviado pra esse pedido? Já opt-out desse cliente (mesma lista
  // do Motor de Recompra, "legítimo interesse" pede opção de saída)?
  let alreadySent: Set<string>;
  try {
    alreadySent = await pedidosComNps(admin, "entrega_nps", candidates.map((c) => c.id));
  } catch (err) {
    return { enrolled: 0, semTelefone: 0, errors: [`entrega-nps já enviados: ${(err as Error).message}`], avisos: [] };
  }
  const naoContatar = await listClientesNaoContatar();

  const eligible = candidates.filter(
    (c) => !alreadySent.has(c.id) && !naoContatar.has(c.client_id as string) && !isMostruarioRequest(c.invoice, c.client_name)
  );
  if (eligible.length === 0) return { enrolled: 0, semTelefone: 0, errors: [], avisos: [] };

  // 4. Telefone -- totvs_orders não tem, precisa do cadastro (mesmo join
  // client_id = protheus_code do resto do projeto). `totvs_clientes` só
  // cobre uma fração de quem já comprou (mesmo gap documentado em
  // totvsLookup.ts/findTotvsClientByCode): diferente de montagem/
  // assistência técnica (telefone vem direto do chamado), aqui a fonte é
  // só a venda no Protheus. Backfill reativo (achado do Victor 26/09/2026:
  // a listagem em massa do Protheus não traz vários clientes reais, mas
  // SearchQuery por código funciona) antes de checar telefone; quem segue
  // sem telefone conta em `semTelefone` (limite de dado conhecido, não
  // erro) e é pulado sem ocupar vaga (ver npsEnvio.ts).
  return enviarNpsPorPedido(admin, {
    tabela: "entrega_nps",
    tag: NPS_GHL_TAG.entrega!,
    rotulo: "entrega-nps",
    candidatos: eligible,
    maxEnvios: MAX_ENROLL_PER_RUN,
    maxBackfill: BACKFILL_MAX_CODES_PER_RUN,
  });
}

export async function detectPendingEntregaNpsResponses(): Promise<number> {
  const admin = getSupabaseAdmin();
  const { data: pending } = await admin
    .from("entrega_nps")
    .select("order_id, ghl_contact_id, enviado_em, client_id, totvs_orders(branch)")
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
    const conversationId = await findGhlConversationId(row.ghl_contact_id);
    if (!conversationId) continue;
    const msgs = await fetchGhlMessages(conversationId);
    if (!msgs) continue;
    const sentAtMs = new Date(row.enviado_em).getTime();
    const reply = msgs.find(
      (m) => m.direction === "inbound" && new Date(m.dateAdded).getTime() > sentAtMs && NPS_1_5_PATTERN.test((m.body ?? "").trim())
    );
    if (!reply) continue;
    const score = Number(NPS_1_5_PATTERN.exec(reply.body!.trim())![1]);
    await admin.from("entrega_nps").update({ score, respondido_em: reply.dateAdded }).eq("order_id", row.order_id);
    answered++;
    await encaminharPelaNota(admin, { score, ghlContactId: row.ghl_contact_id });

    // Pergunta de sugestão -- mandada direto daqui (texto livre, sem
    // Template/Workflow, ver sendGhlMessage), pra TODO MUNDO que respondeu a
    // nota, não só promotor (acerto do Pedro 24/10/2026: a resposta do
    // cliente a essa mensagem é lida depois por detectPendingEntregaSugestoes
    // abaixo, não importa quem mandou a pergunta).
    try {
      await sendGhlMessage(row.ghl_contact_id, "Muito obrigado! 🙏 Se tiver alguma sugestão pra melhorarmos, pode escrever aqui 👇");
    } catch {
      // best-effort -- não pode derrubar a detecção de score, que já
      // aconteceu acima.
    }

    const order = Array.isArray(row.totvs_orders) ? row.totvs_orders[0] : row.totvs_orders;
    await maybeRequestGoogleReview(admin, {
      origem: "entrega",
      origemId: row.order_id,
      clientId: row.client_id,
      score,
      ghlContactId: row.ghl_contact_id,
      storeId: order?.branch ?? null,
    });
  }
  return answered;
}

// Sugestão de melhoria em texto livre -- pedido do Victor 23/10/2026,
// movido de "compra" pra "entrega" (24/10/2026): mais perto do "calor do
// momento" da entrega do que 20 dias depois, mesmo raciocínio do pedido de
// avaliação Google acima. A pergunta em si é mandada direto por
// detectPendingEntregaNpsResponses (sendGhlMessage, sem Template/Workflow) --
// a resposta pode chegar minutos ou horas depois (o cliente responde quando
// quiser), por isso a LEITURA é uma varredura própria, separada da detecção
// de score acima -- não dá pra conferir só no mesmo instante em que a
// pergunta é mandada. `sugestao_verificada` (0199_entrega_sugestao.sql)
// evita reconferir pra sempre: desiste depois de 3 dias sem resposta.
const SUGESTAO_JANELA_DIAS = 3;

export async function detectPendingEntregaSugestoes(): Promise<number> {
  const admin = getSupabaseAdmin();
  const sinceIso = new Date(Date.now() - SUGESTAO_JANELA_DIAS * 24 * 60 * 60 * 1000).toISOString();
  const { data: pending } = await admin
    .from("entrega_nps")
    .select("order_id, ghl_contact_id, respondido_em, client_id, totvs_orders(branch, client_name)")
    .eq("sugestao_verificada", false)
    // descartadas (0201): pessoa errada -- sem pedido de avaliação/sugestão
    .is("descartada_em", null)
    .not("respondido_em", "is", null)
    .gte("respondido_em", sinceIso)
    .order("respondido_em", { ascending: false })
    .limit(200);
  if (!pending || pending.length === 0) return 0;

  let capturadas = 0;
  for (const row of pending) {
    const conversationId = await findGhlConversationId(row.ghl_contact_id);
    if (!conversationId) continue;
    const msgs = await fetchGhlMessages(conversationId);
    if (!msgs) continue;

    const respondidoAtMs = new Date(row.respondido_em).getTime();
    // Qualquer mensagem inbound DEPOIS da resposta de nota que não seja ela
    // mesma (não bate o padrão fixo "N - Label") é texto livre -- é a
    // sugestão.
    const sugestaoMsg = msgs.find(
      (m) => m.direction === "inbound" && new Date(m.dateAdded).getTime() > respondidoAtMs && !NPS_1_5_PATTERN.test((m.body ?? "").trim())
    );
    const expirado = Date.now() - respondidoAtMs > SUGESTAO_JANELA_DIAS * 24 * 60 * 60 * 1000;

    if (sugestaoMsg?.body?.trim()) {
      const order = Array.isArray(row.totvs_orders) ? row.totvs_orders[0] : row.totvs_orders;
      await admin.from("nps_sugestoes").upsert(
        {
          origem: "entrega",
          origem_id: row.order_id,
          client_id: row.client_id,
          client_name: order?.client_name ?? null,
          store_id: order?.branch ?? null,
          mensagem: sugestaoMsg.body.trim(),
          capturada_em: sugestaoMsg.dateAdded,
        },
        { onConflict: "origem,origem_id", ignoreDuplicates: true }
      );
      await admin.from("entrega_nps").update({ sugestao_verificada: true }).eq("order_id", row.order_id);
      capturadas++;
    } else if (expirado) {
      await admin.from("entrega_nps").update({ sugestao_verificada: true }).eq("order_id", row.order_id);
    }
  }
  return capturadas;
}
