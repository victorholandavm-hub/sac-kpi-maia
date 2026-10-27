import { getSupabaseAdmin } from "./supabaseAdmin";
import { isMostruarioRequest } from "./serviceRequests";
import { listClientesNaoContatar } from "./recompra";
import { findGhlConversationId, fetchGhlMessages, type GhlConta } from "./ghlClient";
import { SUBCONTAS } from "./ghlSubcontas";
import { NPS_GHL_TAG, NPS_1_5_PATTERN, sendNpsAutoReply } from "./npsDetratores";
import { enviarNpsPorPedido, pedidosComNps, type ResultadoEnvioNps } from "./npsEnvio";
import { separarVendedorOdoo } from "./vendaNpsOdoo";

// NPS "Pós-venda" -- pedido do Victor 19/10/2026: avaliar o ATENDIMENTO EM
// LOJA, disparado assim que a venda é registrada no Protheus. Mais simples
// que Pós-entrega/Compra (entregaNps.ts/nps2Meses.ts): o gatilho é a venda
// em si (totvs_orders.issue_date), sem precisar cruzar com
// totvs_delivery_cargas (não depende de entrega nenhuma ter acontecido --
// é sobre o vendedor/a loja, não sobre o produto/a logística).
// 150 por rodada desde 21/10/2026 (pedido do Victor: API oficial do
// WhatsApp, sem risco de bloqueio por volume; o que limita é o nível de
// mensagens/24h da conta na Meta). Era 50.
const MAX_ENROLL_PER_RUN = 150;
// Mesmo racional de entregaNps.ts/nps2Meses.ts: cada código faltante de
// totvs_clientes é uma chamada de verdade ao Protheus, e esta função
// compete pelo mesmo orçamento de tempo do /api/sync que as outras 3
// pesquisas de NPS (--max-time 290, ver sync-cron.yml).
const BACKFILL_MAX_CODES_PER_RUN = 20;

// TARGET_DAYS_AGO=0 (não 1+ como as outras) -- "assim que a venda for
// feita" pede o mínimo de espera possível: o pedido já é elegível no
// mesmo dia que aparece sincronizado em totvs_orders, sem esperar virar
// o dia. WINDOW_DAYS=2 só como rede de segurança (absorve o sync ficando
// fora do ar por um tempo sem perder venda nenhuma), mesmo espírito do
// WINDOW_DAYS de entregaNps.ts/nps2Meses.ts.
const WINDOW_DAYS = 2;
const TARGET_DAYS_AGO = 0;

type OrderRow = { id: string; client_id: string | null; client_name: string | null; invoice: string | null; issue_date: string };

// Em dia de Recife: issue_date é a data da venda lá, e em UTC o dia virava
// às 21h e jogava a janela um dia pra frente.
function isoDaysAgo(days: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Recife" }).format(new Date(Date.now() - days * 24 * 60 * 60 * 1000));
}

type OrdemVenda = { issue_date: string };

// Quem vence a janela hoje vai na frente (Victor 21/10/2026: com as mais
// novas primeiro, venda de 2 dias atrás podia ficar pra trás em dia de muito
// movimento e sair da janela sem pesquisa); o resto, a mais nova primeiro --
// a ordem que já vem da consulta.
export function priorizarVendas<T extends OrdemVenda>(vendas: T[], ultimoDiaDaJanela: string): T[] {
  return [...vendas.filter((v) => v.issue_date <= ultimoDiaDaJanela), ...vendas.filter((v) => v.issue_date > ultimoDiaDaJanela)];
}

// Subconta do disparo (Victor 21/10/2026: "fosse feito pelo numero da Lojas
// Maia e nao do sac, pois está congestionando o sac"). VENDA_NPS_SUBCONTA=
// lojas_maia liga; sem a variável continua pelo SAC. Na Lojas Maia o
// Workflow "NPS Pós Atendimento Loja" reage a outra tag.
const TAG_LOJAS_MAIA = "nps-pos-atendimento-loja";

function contaLojasMaia(): GhlConta {
  return { token: process.env[SUBCONTAS.lojas_maia.tokenEnv], locationId: SUBCONTAS.lojas_maia.locationId };
}

function disparoVenda(): { conta?: GhlConta; tag: string } {
  return process.env.VENDA_NPS_SUBCONTA === "lojas_maia" ? { conta: contaLojasMaia(), tag: TAG_LOJAS_MAIA } : { tag: NPS_GHL_TAG.venda! };
}

// Respostas: as mais recentes primeiro e só dos últimos 7 dias -- sem ordem,
// as 100 primeiras pendentes eram sempre as mesmas (quem nunca responde) e
// as novas não eram lidas.
const RESPOSTA_JANELA_DIAS = 7;
const RESPOSTA_MAX_POR_RODADA = 200;

export async function enrollPendingVendaNps(): Promise<ResultadoEnvioNps> {
  const admin = getSupabaseAdmin();

  // 1. Vendas recentes -- direto em totvs_orders, sem passar por cargas
  // (diferente de entregaNps.ts/nps2Meses.ts). A mais nova primeiro (a
  // promessa é "assim que a venda for feita"), menos a que vence hoje (ver
  // priorizarVendas).
  const fromDate = isoDaysAgo(TARGET_DAYS_AGO + WINDOW_DAYS);
  const toDate = isoDaysAgo(TARGET_DAYS_AGO);
  const { data: orderRows, error: ordersError } = await admin
    .from("totvs_orders")
    .select("id, client_id, client_name, invoice, issue_date")
    .not("client_id", "is", null)
    .gte("issue_date", fromDate)
    .lte("issue_date", toDate)
    .order("issue_date", { ascending: false })
    .order("created_at", { ascending: false })
    .returns<OrderRow[]>();
  if (ordersError) return { enrolled: 0, semTelefone: 0, errors: [`venda-nps pedidos: ${ordersError.message}`], avisos: [] };
  const candidates = (orderRows ?? []).filter((o) => o.client_id);
  if (candidates.length === 0) return { enrolled: 0, semTelefone: 0, errors: [], avisos: [] };

  // 2. Já enviado pra esse pedido? Já opt-out desse cliente?
  let alreadySent: Set<string>;
  try {
    alreadySent = await pedidosComNps(admin, "venda_nps", candidates.map((c) => c.id));
  } catch (err) {
    return { enrolled: 0, semTelefone: 0, errors: [`venda-nps já enviados: ${(err as Error).message}`], avisos: [] };
  }
  const naoContatar = await listClientesNaoContatar();

  const eligible = priorizarVendas(
    candidates.filter(
      (c) => !alreadySent.has(c.id) && !naoContatar.has(c.client_id as string) && !isMostruarioRequest(c.invoice, c.client_name)
    ),
    fromDate
  );
  if (eligible.length === 0) return { enrolled: 0, semTelefone: 0, errors: [], avisos: [] };

  // 3. Telefone -- mesmo gap/mesmo backfill reativo de entregaNps.ts/
  // nps2Meses.ts (totvs_orders não tem telefone, só o cadastro).
  const disparo = disparoVenda();
  return enviarNpsPorPedido(admin, {
    tabela: "venda_nps",
    tag: disparo.tag,
    conta: disparo.conta,
    rotulo: "venda-nps",
    candidatos: eligible,
    maxEnvios: MAX_ENROLL_PER_RUN,
    maxBackfill: BACKFILL_MAX_CODES_PER_RUN,
  });
}

export async function detectPendingVendaNpsResponses(): Promise<number> {
  const admin = getSupabaseAdmin();
  const { data: pending } = await admin
    .from("venda_nps")
    .select("order_id, ghl_contact_id, enviado_em, ghl_location_id")
    .is("respondido_em", null)
    .gte("enviado_em", new Date(Date.now() - RESPOSTA_JANELA_DIAS * 24 * 60 * 60 * 1000).toISOString())
    .order("enviado_em", { ascending: false })
    .limit(RESPOSTA_MAX_POR_RODADA);
  if (!pending || pending.length === 0) return 0;

  let answered = 0;
  for (const row of pending) {
    // Linha sem ghl_location_id foi enviada pelo SAC (antes de 21/10/2026).
    const conta = row.ghl_location_id === SUBCONTAS.lojas_maia.locationId ? contaLojasMaia() : undefined;
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
    await admin.from("venda_nps").update({ score, respondido_em: reply.dateAdded }).eq("order_id", row.order_id);
    await sendNpsAutoReply(row.ghl_contact_id, score, conta);
    answered++;
  }
  return answered;
}

export type VendedorRankingEntry = {
  sellerName: string;
  responseCount: number;
  npsIndex: number;
  avgScore: number;
};

type VendaScoreRow = {
  score: number;
  totvs_orders: { seller_name: string | null } | { seller_name: string | null }[] | null;
};

// Ranking de vendedores pelo NPS Pós-venda -- pedido do Victor 19/10/2026,
// botão dentro do card "Pós-venda (atendimento em loja)". Agrupa por
// seller_name (totvs_orders, mesmo join de listNpsRespostasPorFase em
// npsDetratores.ts) -- sem mínimo de respostas pra entrar na lista
// (diferente do ranking de evolução do Google, GoogleReviewsSection.tsx),
// porque aqui é pouca gente por vendedor desde o início; responseCount vai
// junto em cada linha pra quem olha julgar sozinho a confiabilidade da
// nota com poucas respostas.
export async function getVendaSellerRanking(): Promise<VendedorRankingEntry[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("venda_nps")
    .select("score, totvs_orders(seller_name)")
    .not("score", "is", null)
    .returns<VendaScoreRow[]>();
  if (error) throw new Error(error.message);

  const scoresBySeller = new Map<string, number[]>();
  const somar = (nome: string | null | undefined, score: number) => {
    const sellerName = nome?.trim();
    if (!sellerName) return;
    scoresBySeller.set(sellerName, [...(scoresBySeller.get(sellerName) ?? []), score]);
  };
  for (const row of data ?? []) {
    const order = Array.isArray(row.totvs_orders) ? row.totvs_orders[0] : row.totvs_orders;
    somar(order?.seller_name, row.score);
  }
  // Vendas do Odoo (venda_nps_odoo, desde 25/10): vendedor vem da expedição.
  const { data: odoo, error: odooError } = await admin.from("venda_nps_odoo").select("score, vendedor").not("score", "is", null).is("descartada_em", null);
  if (odooError) throw new Error(odooError.message);
  for (const row of odoo ?? []) somar(separarVendedorOdoo(row.vendedor as string | null).nome, row.score as number);

  const entries: VendedorRankingEntry[] = [...scoresBySeller.entries()].map(([sellerName, scores]) => {
    const promoters = scores.filter((s) => s >= 4).length;
    const detractors = scores.filter((s) => s <= 2).length;
    const npsIndex = Math.round(((promoters - detractors) / scores.length) * 100);
    const avgScore = Math.round((scores.reduce((sum, s) => sum + s, 0) / scores.length) * 10) / 10;
    return { sellerName, responseCount: scores.length, npsIndex, avgScore };
  });

  // Maior NPS primeiro; empate desempata por quem tem mais respostas (nota
  // mais confiável) -- mesmo critério do ranking de avaliações do Google.
  entries.sort((a, b) => b.npsIndex - a.npsIndex || b.responseCount - a.responseCount);
  return entries;
}
