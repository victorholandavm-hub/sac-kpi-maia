import { getSupabaseAdmin } from "./supabaseAdmin";
import { isMostruarioRequest } from "./serviceRequests";
import { listClientesNaoContatar } from "./recompra";
import { RESOLVIDO_LABELS } from "./entregasRisco";
import { upsertGhlContact, addContactToWorkflow, findGhlConversationId, fetchGhlMessages } from "./ghlClient";
import type { NpsFaseResumo } from "./npsDetratores";

// NPS "2 meses pós-recebimento" -- pedido do Victor 09/09/2026: "Cliente so
// pode receber uma a cada 90 dias. Gatilho é a data de entrega, e coloque 2
// meses apos o recebimento e nao um [mês]". Diferente dos outros 3 tipos de
// NPS (service_request_nps, um chamado de assistência por trás): esse é
// por PEDIDO de venda (totvs_orders), sem chamado nenhum envolvido.
//
// Volume bem maior que os outros 3 juntos (~7.600 pedidos/mês contra ~450)
// -- por isso o limite de 90 dias por cliente (não manda de novo pra quem
// compra toda semana) e um teto por rodada (MAX_ENROLL_PER_RUN abaixo),
// pra não fazer o /api/sync demorar mais do que já demora (ver o histórico
// de timeout do Nginx, corrigido 08/09/2026 -- não é pra repetir).
const MAX_ENROLL_PER_RUN = 50;

// Janela de 7 dias (não só "exatamente 60 dias atrás") -- absorve o sync
// ficando fora do ar por alguns dias sem perder ninguém que devia ter
// entrado na janela nesse meio tempo. Mesmo espírito do "catch up" que a
// task agendada do totvs-sync já tem (StartWhenAvailable).
const WINDOW_DAYS = 7;
const TARGET_DAYS_AGO = 60;

type CargaRow = { nota_fiscal: string | null; serie: string | null };
type OrderRow = { id: string; invoice: string | null; serie: string | null; client_id: string | null; client_name: string | null };

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export async function enrollPendingCompraNps(): Promise<{ enrolled: number; errors: string[] }> {
  const workflowId = process.env.GHL_WORKFLOW_ID_COMPRA;
  if (!workflowId) return { enrolled: 0, errors: [] };

  const admin = getSupabaseAdmin();
  const errors: string[] = [];

  // 1. Cargas entregues (de verdade, não "Cancelada"/"Em rota") há ~2
  // meses -- mesmo critério de resolvido que entregasRisco.ts/recompra.ts
  // já usam.
  const fromDate = isoDaysAgo(TARGET_DAYS_AGO + WINDOW_DAYS);
  const toDate = isoDaysAgo(TARGET_DAYS_AGO);
  const { data: cargas, error: cargasError } = await admin
    .from("totvs_delivery_cargas")
    .select("nota_fiscal, serie")
    .not("nota_fiscal", "is", null)
    .gte("dt_retorno", fromDate)
    .lte("dt_retorno", toDate)
    .in("status_entrega", RESOLVIDO_LABELS)
    .returns<CargaRow[]>();
  if (cargasError) return { enrolled: 0, errors: [`compra-nps cargas: ${cargasError.message}`] };
  if (!cargas || cargas.length === 0) return { enrolled: 0, errors: [] };

  // 2. Cruza com o pedido de venda -- mesmo join (invoice+serie, sem
  // branch/filial) já descoberto e usado em recompra.ts.
  const notasFiscais = [...new Set(cargas.map((c) => c.nota_fiscal).filter((n): n is string => !!n))];
  const seriesByNota = new Map<string, Set<string>>();
  for (const c of cargas) {
    if (!c.nota_fiscal || !c.serie) continue;
    const set = seriesByNota.get(c.nota_fiscal) ?? new Set<string>();
    set.add(c.serie);
    seriesByNota.set(c.nota_fiscal, set);
  }

  const { data: orderRows, error: ordersError } = await admin
    .from("totvs_orders")
    .select("id, invoice, serie, client_id, client_name")
    .in("invoice", notasFiscais)
    .returns<OrderRow[]>();
  if (ordersError) return { enrolled: 0, errors: [`compra-nps pedidos: ${ordersError.message}`] };

  const candidates = (orderRows ?? []).filter((o) => o.invoice && o.serie && seriesByNota.get(o.invoice)?.has(o.serie) && o.client_id);
  if (candidates.length === 0) return { enrolled: 0, errors: [] };

  // 3. Já enviado pra esse pedido? Já opt-out desse cliente (mesma lista
  // do Motor de Recompra, "legítimo interesse" pede opção de saída)?
  const { data: already } = await admin
    .from("compra_nps")
    .select("order_id")
    .in("order_id", candidates.map((c) => c.id));
  const alreadySent = new Set((already ?? []).map((r) => r.order_id as string));
  const naoContatar = await listClientesNaoContatar();

  let eligible = candidates.filter(
    (c) => !alreadySent.has(c.id) && !naoContatar.has(c.client_id as string) && !isMostruarioRequest(c.invoice, c.client_name)
  );
  if (eligible.length === 0) return { enrolled: 0, errors: [] };

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
  const { data: recentSends } = await admin
    .from("compra_nps")
    .select("client_id")
    .in("client_id", eligible.map((c) => c.client_id as string))
    .gte("enviado_em", sinceIso);
  const recentlyContacted = new Set((recentSends ?? []).map((r) => r.client_id as string));
  eligible = eligible.filter((c) => !recentlyContacted.has(c.client_id as string));
  if (eligible.length === 0) return { enrolled: 0, errors: [] };

  // 6. Telefone -- totvs_orders não tem, precisa do cadastro (mesmo join
  // client_id = protheus_code que o resto do projeto já usa, ver
  // clientes.ts). Sem telefone cadastrado, não dá pra mandar.
  const clientIds = [...new Set(eligible.map((c) => c.client_id as string))];
  const { data: clienteRows } = await admin.from("totvs_clientes").select("protheus_code, phone1").in("protheus_code", clientIds);
  const phoneByClientId = new Map((clienteRows ?? []).map((r) => [r.protheus_code as string, r.phone1 as string | null]));

  eligible = eligible.slice(0, MAX_ENROLL_PER_RUN);

  let enrolled = 0;
  for (const candidate of eligible) {
    const phone = phoneByClientId.get(candidate.client_id as string);
    if (!phone) continue;

    const contactId = await upsertGhlContact(phone, candidate.client_name);
    if (!contactId) {
      errors.push(`compra-nps ${candidate.id}: não achou/criou contato no GHL`);
      continue;
    }
    if (!(await addContactToWorkflow(contactId, workflowId))) {
      errors.push(`compra-nps ${candidate.id}: falha ao matricular no workflow`);
      continue;
    }
    const { error: insertError } = await admin
      .from("compra_nps")
      .insert({ order_id: candidate.id, client_id: candidate.client_id, ghl_contact_id: contactId });
    if (insertError) errors.push(`compra-nps ${candidate.id}: ${insertError.message}`);
    else enrolled++;
  }
  return { enrolled, errors };
}

// Mesmo padrão de detectPendingNpsResponses (api/sync/route.ts) -- resposta
// é um número sozinho de 0 a 10, só considera mensagem inbound DEPOIS de
// enviado_em (mesma conversa pode ter mais de uma pesquisa ao longo do
// tempo, incluindo a do SAC).
const SCORE_PATTERN = /^\s*(10|[0-9])\s*$/;

export async function detectPendingCompraNpsResponses(): Promise<number> {
  const admin = getSupabaseAdmin();
  const { data: pending } = await admin
    .from("compra_nps")
    .select("order_id, ghl_contact_id, enviado_em")
    .is("respondido_em", null)
    .limit(100);
  if (!pending || pending.length === 0) return 0;

  let answered = 0;
  for (const row of pending) {
    const conversationId = await findGhlConversationId(row.ghl_contact_id);
    if (!conversationId) continue;
    const msgs = await fetchGhlMessages(conversationId);
    if (!msgs) continue;
    const sentAtMs = new Date(row.enviado_em).getTime();
    const reply = msgs.find(
      (m) => m.direction === "inbound" && new Date(m.dateAdded).getTime() > sentAtMs && SCORE_PATTERN.test((m.body ?? "").trim())
    );
    if (!reply) continue;
    const score = Number(SCORE_PATTERN.exec(reply.body!.trim())![1]);
    await admin.from("compra_nps").update({ score, respondido_em: reply.dateAdded }).eq("order_id", row.order_id);
    answered++;
  }
  return answered;
}

// Resumo (NPS clássico: %promotores - %detratores) pro card "2 meses
// pós-recebimento" do Resumo de /avaliacoes -- mesmo formato de
// getNpsResumoPorFaseAdicional (npsDetratores.ts), função própria porque
// compra_nps é tabela separada (sem chamado de assistência por trás).
export async function getCompraNpsResumo(): Promise<NpsFaseResumo> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("compra_nps").select("score").not("score", "is", null);
  if (error) throw new Error(error.message);

  const scores = (data ?? []).map((r) => r.score as number);
  if (scores.length === 0) return { npsIndex: null, responseCount: 0 };
  const promoters = scores.filter((s) => s >= 9).length;
  const detractors = scores.filter((s) => s <= 6).length;
  const npsIndex = Math.round(((promoters - detractors) / scores.length) * 100);
  return { npsIndex, responseCount: scores.length };
}
