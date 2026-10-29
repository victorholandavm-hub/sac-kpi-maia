import type { getSupabaseAdmin } from "./supabaseAdmin";
import { assignGhlContact, type GhlConta } from "./ghlClient";
import { ATENDENTES_SAC } from "./ghlSubcontas";
import { maybeRequestGoogleReview, type GoogleReviewOrigem } from "./googleReviewRequest";

// O que fazer com a nota da pesquisa 1-5 -- Victor 29/10/2026 (print do José
// Erivaldo: nota 1 caiu com a loja, "comprei e paguei e a mercadoria não
// chegou"): de 3 pra baixo a conversa vai pro SAC; 4 e 5 recebem o pedido de
// avaliação no Google. Best-effort: a nota já está gravada antes.

export const NOTA_MAXIMA_SAC = 3;

// Pedido de troca do SAC é lançado como venda ("TROCA C/ RECOLHIMENTO SAC" na
// observação): nenhuma pesquisa de loja/entrega/compra -- Victor 29/10/2026,
// só o NPS de assistência técnica do chamado.
export const ehPedidoDeTroca = (obs: string | null | undefined) => /\btroca\b/i.test(obs ?? "");

// Quem recebe as notas baixas (Victor 29/10/2026: "deixe só Ingrid, Jaluska
// e Flávio"). Mesma atendente pro mesmo contato (rodízio pelo id do contato).
export const ATENDENTES_NOTA_BAIXA = ATENDENTES_SAC.filter((a) => ["Ingrid", "Jaluska", "Flávio"].includes(a.nome));

export function atendenteDoSac(ghlContactId: string): (typeof ATENDENTES_SAC)[number] {
  let h = 0;
  for (const c of ghlContactId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return ATENDENTES_NOTA_BAIXA[h % ATENDENTES_NOTA_BAIXA.length];
}

// Cliente do Odoo não tem código nosso: o telefone faz o papel no intervalo
// de 90 dias do pedido de avaliação.
export const clientePeloTelefone = (telefone: string | null | undefined) => {
  const d = (telefone ?? "").replace(/\D/g, "");
  return d ? `tel:${d}` : null;
};

export async function encaminharPelaNota(
  admin: ReturnType<typeof getSupabaseAdmin>,
  opts: {
    score: number;
    ghlContactId: string;
    conta?: GhlConta;
    avaliacao?: { origem: GoogleReviewOrigem; origemId: string; clientId: string | null; storeId: string | null };
  }
): Promise<void> {
  if (opts.score <= NOTA_MAXIMA_SAC) {
    await assignGhlContact(opts.ghlContactId, atendenteDoSac(opts.ghlContactId).userId, opts.conta).catch(() => false);
    return;
  }
  if (opts.avaliacao) {
    await maybeRequestGoogleReview(admin, { ...opts.avaliacao, score: opts.score, ghlContactId: opts.ghlContactId, conta: opts.conta });
  }
}
