import type { getSupabaseAdmin } from "./supabaseAdmin";
import { sendGhlMessage, type GhlConta } from "./ghlClient";
import { listClientesNaoContatar } from "./recompra";

// Pedido de avaliação Google pros clientes promotores -- pedido do Victor
// 23/10/2026, restrito à pesquisa "Pós-entrega" (24/10/2026, decisão do
// Victor): é a que dispara mais perto do "calor do momento" (1-2 dias
// depois da entrega, contra 20 dias de "compra"), maior chance de converter
// em avaliação de verdade -- e evita pedir a mesma coisa mais de uma vez
// pro mesmo cliente que também é promotor em venda/montagem/assistência
// (esses NÃO chamam essa função). Chamada de dentro de
// detectPendingEntregaNpsResponses (entregaNps.ts) logo depois que o score
// é gravado, reaproveitando o ghlContactId que a pesquisa já resolveu (sem
// telefone/contato de novo).
//
// Mensagem livre (sendGhlMessage), não tag+Workflow+Template -- achado do
// Pedro 24/10/2026: Template de pedido de avaliação sempre cai como
// categoria "Marketing" na revisão da Meta (não tem como fugir reformulando
// o texto), que só entrega pra quem tem opt-in de marketing. Mensagem livre
// dentro da janela de 24h (sempre é o caso aqui -- isso roda logo depois de
// detectar a resposta do próprio cliente) não passa por template nem
// categoria nenhuma. Sem custom field também: o link da loja já vai embutido
// direto no texto.
//
// Best-effort de propósito: nunca lança -- um problema aqui (loja sem link,
// GHL fora do ar) não pode derrubar a detecção da pesquisa original por
// trás, que já rodou e gravou o score antes de chamar isso.
// "venda" e "compra": desde 29/10/2026 (Victor: "4 e 5 é avaliação do
// Google") toda pesquisa 1-5 pede; o intervalo de 90 dias por cliente evita
// pedir de novo.
export type GoogleReviewOrigem = "entrega" | "venda" | "compra";

// "Pós-entrega" não tem o limite de 1 pesquisa a cada X dias por cliente
// que "compra" tem (um cliente com 2 entregas na mesma semana recebe as
// duas pesquisas de propósito) -- sem essa trava aqui, um cliente que
// compra com frequência receberia o pedido de avaliação Google de novo a
// cada entrega nova. 90 dias, mesmo prazo que compra_nps já usa pro envio
// da pesquisa em si.
const COOLDOWN_DIAS = 90;

type Admin = ReturnType<typeof getSupabaseAdmin>;

export async function maybeRequestGoogleReview(
  admin: Admin,
  opts: {
    origem: GoogleReviewOrigem;
    origemId: string;
    clientId: string | null;
    score: number;
    ghlContactId: string;
    storeId: string | null;
    conta?: GhlConta;
  }
): Promise<void> {
  if (opts.score < 4) return;
  if (!opts.storeId) return;

  try {
    const { data: store } = await admin.from("stores").select("google_maps_url").eq("id", opts.storeId).single();
    const link = (store?.google_maps_url as string | null) ?? null;
    if (!link) return;

    if (opts.clientId) {
      const naoContatar = await listClientesNaoContatar();
      if (naoContatar.has(opts.clientId)) return;

      const sinceIso = new Date(Date.now() - COOLDOWN_DIAS * 24 * 60 * 60 * 1000).toISOString();
      const { data: recentes } = await admin
        .from("google_review_requests")
        .select("id")
        .eq("client_id", opts.clientId)
        .gte("enviado_em", sinceIso)
        .limit(1);
      if (recentes && recentes.length > 0) return;
    }

    // Reserva antes de mexer no GHL (mesmo motivo de npsEnvio.ts): só
    // segue se a linha entrou agora, evita pedir duas vezes em execuções
    // paralelas ou já ter pedido antes por outro pedido/chamado do mesmo
    // cliente.
    const { data: reservada, error } = await admin
      .from("google_review_requests")
      .upsert(
        {
          origem: opts.origem,
          origem_id: opts.origemId,
          client_id: opts.clientId,
          store_id: opts.storeId,
          score: opts.score,
          ghl_contact_id: opts.ghlContactId,
        },
        { onConflict: "origem,origem_id", ignoreDuplicates: true }
      )
      .select("id");
    if (error || !reservada || reservada.length === 0) return;

    await sendGhlMessage(
      opts.ghlContactId,
      `Que bom que você gostou! 😀 Poderia deixar sua avaliação da loja no Google? ${link}`,
      opts.conta
    );
  } catch {
    // best-effort, ver comentário no topo do arquivo.
  }
}
