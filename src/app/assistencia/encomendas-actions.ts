"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireEncomendaAction } from "@/lib/dal";
import { requireEncomendaActor } from "@/lib/encomendaAuth";
import { resolveEncomendaRequester } from "@/lib/encomendaRequester";
import { getClientIp, checkAndRecordPublicSubmission } from "@/lib/rateLimit";
import {
  createPedidoEncomenda,
  updatePedidoStatus,
  addPedidoNote,
  setPedidoPrazo,
  isPedidoEncomendaStatus,
  type NewPedidoEncomendaItem,
} from "@/lib/pedidosEncomenda";
import { saveEncomendaPhoto } from "@/lib/pedidoEncomendaPhotos";
import { searchTotvsOrdersByInvoice, type TotvsOrderSuggestion } from "@/lib/totvsLookup";

export type FormState = { error?: string } | undefined;

// Sugestão de NF-e ao informar faturamento da encomenda -- não valida, só
// ajuda a achar a NF certa (ver PedidoEncomendaActions.tsx).
export async function searchNfSuggestions(query: string, storeId: string): Promise<TotvsOrderSuggestion[]> {
  await requireEncomendaActor();
  return searchTotvsOrdersByInvoice(query, storeId);
}

// Caixa, vendedor ou gerente lançam o pedido direto (formulário, sem
// foto/WhatsApp) — gated por resolveEncomendaRequester (src/lib/encomendaRequester.ts),
// que tenta as três sessões em sequência. Caixa/vendedor resolvem pra uma
// loja só; gerente com mais de uma loja escolhe no formulário (validado
// contra as lojas dele, nunca confiando cegamente no valor do form).
export async function createPedidoEncomendaAction(_state: FormState, formData: FormData): Promise<FormState> {
  const ip = await getClientIp();
  const { allowed } = await checkAndRecordPublicSubmission(ip);
  if (!allowed) {
    return { error: "Muitas solicitações enviadas em pouco tempo. Aguarde alguns minutos e tente de novo." };
  }

  const requester = await resolveEncomendaRequester();
  if (!requester) return { error: "Sessão expirada. Faça login de novo." };

  let storeId: string;
  const requestedByName = requester.name;
  if (requester.kind === "gerente") {
    const chosenStoreId = String(formData.get("store_id") ?? "").trim();
    if (requester.storeIds.length === 1) {
      storeId = requester.storeIds[0];
    } else {
      if (!requester.storeIds.includes(chosenStoreId)) return { error: "Selecione uma loja válida." };
      storeId = chosenStoreId;
    }
  } else if (requester.kind === "cd" || requester.kind === "fabrica") {
    // CD/fábrica não têm loja fixa — escolhem na hora de lançar o pedido,
    // dentre todas as lojas (ver solicitar/page.tsx). Validado abaixo contra
    // a tabela stores, igual já acontece pros outros papéis.
    const chosenStoreId = String(formData.get("store_id") ?? "").trim();
    if (!chosenStoreId) return { error: "Selecione a loja do pedido." };
    storeId = chosenStoreId;
  } else {
    storeId = requester.storeId;
  }

  const admin = getSupabaseAdmin();
  const { data: store } = await admin.from("stores").select("name").eq("id", storeId).maybeSingle();
  if (!store) return { error: "Loja inválida." };

  const vendedorName = String(formData.get("vendedor_name") ?? "").trim() || null;
  const clienteCodigo = String(formData.get("cliente_codigo") ?? "").trim() || null;

  const produtoDescricoes = formData.getAll("item_produto_descricao").map((v) => String(v).trim());
  const quantidades = formData.getAll("item_quantidade").map((v) => {
    const n = parseInt(String(v), 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
  });
  const items: NewPedidoEncomendaItem[] = produtoDescricoes
    .map((produtoDescricao, i) => ({ produtoDescricao, quantidade: quantidades[i] ?? 1 }))
    .filter((item) => item.produtoDescricao.length > 0);

  if (items.length === 0) {
    return { error: "Adicione pelo menos um produto." };
  }

  const notes = String(formData.get("notes") ?? "").trim() || null;

  let pedidoId: string;
  let pedidoNumber: number;
  try {
    const result = await createPedidoEncomenda({ storeId, requestedByName, vendedorName, clienteCodigo, notes, items });
    pedidoId = result.id;
    pedidoNumber = result.pedidoNumber;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Não foi possível criar o pedido." };
  }

  const cupomFiscal = formData.get("cupom_fiscal");
  if (cupomFiscal instanceof File && cupomFiscal.size > 0) {
    try {
      await saveEncomendaPhoto({ pedidoId, file: cupomFiscal, uploadedBy: requestedByName, caption: "Cupom fiscal" });
    } catch (err) {
      // Pedido já foi criado — não bloqueia o fluxo por causa da foto, só avisa.
      return {
        error: `Pedido #${pedidoNumber} criado, mas a foto não pôde ser salva: ${err instanceof Error ? err.message : "erro desconhecido"}`,
      };
    }
  }

  revalidatePath("/assistencia/encomendas/caixa");
  revalidatePath("/assistencia/encomendas/fila");
  redirect(`/assistencia/encomendas/solicitar?enviado=1&pedido=${pedidoNumber}`);
}

// Avanço de status pela fila interna (fábrica/CD/admin/assistência) — mesmo
// padrão de updatePartOrderStatus (src/app/assistencia/pecas-actions.ts), mas
// com a transição validada por papel em requireEncomendaAction (dal.ts): cada
// papel só avança o trecho do fluxo que é dele. requireEncomendaActor()
// resolve sessão PIN de CD/fábrica ou perfil Supabase Auth de admin/assistência.
export async function advancePedidoStatus(
  pedidoId: string,
  toStatus: string,
  opts: { carga?: string; nfE?: string } = {}
): Promise<void> {
  const actor = await requireEncomendaActor();
  if (!isPedidoEncomendaStatus(toStatus)) throw new Error("Status inválido.");
  // Cancelamento e negação sempre passam por cancelPedido/denyPedido (nota
  // obrigatória) — não por aqui, senão dava pra pular o motivo.
  if (toStatus === "cancelado") throw new Error("Use a ação de cancelamento.");
  if (toStatus === "negado") throw new Error("Use a ação de negar pedido.");

  const admin = getSupabaseAdmin();
  const { data: current, error: fetchError } = await admin
    .from("pedidos_encomenda")
    .select("status")
    .eq("id", pedidoId)
    .single();
  if (fetchError || !current) throw new Error("Pedido não encontrado.");

  requireEncomendaAction(actor, current.status, toStatus);

  if (toStatus === "em_carga" && !opts.carga?.trim()) {
    throw new Error("Informe o número da carga.");
  }
  if (toStatus === "faturado" && !opts.nfE?.trim()) {
    throw new Error("Informe o número da NF-e.");
  }

  await updatePedidoStatus(pedidoId, actor, current.status, toStatus, {
    carga: opts.carga?.trim(),
    nfE: opts.nfE?.trim(),
  });

  revalidatePath("/assistencia/encomendas/fila");
  revalidatePath(`/assistencia/encomendas/fila/${pedidoId}`);
  revalidatePath("/assistencia/encomendas/caixa");
}

// Ação em lote da fábrica (ou admin/assistência) pra marcar vários pedidos
// "em produção" como "enviado para o CD" de uma vez, evitando abrir um por um
// -- mesma regra de transição de advancePedidoStatus (requireEncomendaAction),
// só que validada pra todos os ids ANTES de gravar qualquer um (tudo ou nada,
// sem aplicar parcial se algum pedido não puder avançar).
export async function bulkMarkEnviadoParaCD(pedidoIds: string[]): Promise<void> {
  const actor = await requireEncomendaActor();
  if (pedidoIds.length === 0) throw new Error("Selecione ao menos um pedido.");

  const admin = getSupabaseAdmin();
  const { data: rows, error: fetchError } = await admin
    .from("pedidos_encomenda")
    .select("id, status")
    .in("id", pedidoIds);
  if (fetchError || !rows || rows.length !== pedidoIds.length) {
    throw new Error("Um ou mais pedidos não foram encontrados.");
  }

  for (const row of rows) {
    requireEncomendaAction(actor, row.status, "pronto_para_expedicao");
  }
  for (const row of rows) {
    await updatePedidoStatus(row.id, actor, row.status, "pronto_para_expedicao");
  }

  revalidatePath("/assistencia/encomendas/fila");
}

// Cancelamento fica restrito a admin/assistência e sempre exige um motivo,
// já que reverte o trabalho de loja/fábrica/CD.
export async function cancelPedido(pedidoId: string, note: string): Promise<void> {
  const actor = await requireEncomendaActor();
  if (actor.role !== "admin" && actor.role !== "assistencia") {
    throw new Error(`Ação não permitida para o papel "${actor.role}".`);
  }
  if (!note.trim()) throw new Error("Informe o motivo do cancelamento.");

  const admin = getSupabaseAdmin();
  const { data: current, error: fetchError } = await admin
    .from("pedidos_encomenda")
    .select("status")
    .eq("id", pedidoId)
    .single();
  if (fetchError || !current) throw new Error("Pedido não encontrado.");

  await updatePedidoStatus(pedidoId, actor, current.status, "cancelado", { note: note.trim() });

  revalidatePath("/assistencia/encomendas/fila");
  revalidatePath(`/assistencia/encomendas/fila/${pedidoId}`);
  revalidatePath("/assistencia/encomendas/caixa");
}

// Negação fica restrita à fábrica (ou admin/assistência, por supervisão) e só
// vale enquanto o pedido ainda está "solicitado" — depois que entra em
// produção, qualquer desistência já passa por cancelPedido. Motivo sempre
// obrigatório, igual ao cancelamento.
export async function denyPedido(pedidoId: string, reason: string): Promise<void> {
  const actor = await requireEncomendaActor();
  if (actor.role !== "fabrica" && actor.role !== "admin" && actor.role !== "assistencia") {
    throw new Error(`Ação não permitida para o papel "${actor.role}".`);
  }
  if (!reason.trim()) throw new Error("Informe o motivo da recusa.");

  const admin = getSupabaseAdmin();
  const { data: current, error: fetchError } = await admin
    .from("pedidos_encomenda")
    .select("status")
    .eq("id", pedidoId)
    .single();
  if (fetchError || !current) throw new Error("Pedido não encontrado.");
  if (current.status !== "solicitado") throw new Error("Só é possível negar um pedido que ainda está solicitado.");

  await updatePedidoStatus(pedidoId, actor, current.status, "negado", { note: reason.trim() });

  revalidatePath("/assistencia/encomendas/fila");
  revalidatePath(`/assistencia/encomendas/fila/${pedidoId}`);
  revalidatePath("/assistencia/encomendas/caixa");
}

export async function addPedidoNoteAction(pedidoId: string, note: string): Promise<void> {
  const actor = await requireEncomendaActor();
  await addPedidoNote(pedidoId, actor, note);
  revalidatePath(`/assistencia/encomendas/fila/${pedidoId}`);
}

// Previsão de entrega — fábrica ou CD (ou admin/assistência) definem/editam
// a qualquer momento, sempre opcional, sem travar nenhuma transição de
// status. prazoEntrega vazio remove a previsão já definida.
export async function setPedidoPrazoAction(pedidoId: string, prazoEntrega: string | null): Promise<void> {
  const actor = await requireEncomendaActor();
  await setPedidoPrazo(pedidoId, actor, prazoEntrega);
  revalidatePath(`/assistencia/encomendas/fila/${pedidoId}`);
  revalidatePath("/assistencia/encomendas/fila");
  revalidatePath("/assistencia/encomendas/caixa");
}
