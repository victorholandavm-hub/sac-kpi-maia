"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireFornecedorPedidoActor } from "@/lib/fornecedorPedidoAuth";
import {
  createPedidoFornecedor,
  updatePedidoFornecedorStatus,
  addPedidoFornecedorNote,
  setPedidoFornecedorExpectedAt,
  type NewPedidoFornecedorItem,
} from "@/lib/pedidosFornecedor";

export type FormState = { error?: string } | undefined;

export async function createPedidoFornecedorAction(_state: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireFornecedorPedidoActor();

  const fornecedor = String(formData.get("fornecedor") ?? "").trim();
  if (!fornecedor) return { error: "Selecione o fornecedor." };

  const admin = getSupabaseAdmin();
  const { data: supplier } = await admin.from("suppliers").select("name").eq("name", fornecedor).maybeSingle();
  if (!supplier) return { error: "Fornecedor inválido." };

  const produtoDescricoes = formData.getAll("item_produto_descricao").map((v) => String(v).trim());
  const quantidades = formData.getAll("item_quantidade").map((v) => {
    const n = parseInt(String(v), 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
  });
  const items: NewPedidoFornecedorItem[] = produtoDescricoes
    .map((produtoDescricao, i) => ({ produtoDescricao, quantidade: quantidades[i] ?? 1 }))
    .filter((item) => item.produtoDescricao.length > 0);

  if (items.length === 0) {
    return { error: "Adicione pelo menos um produto." };
  }

  const expectedAt = String(formData.get("expected_at") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  let pedidoNumber: number;
  try {
    const result = await createPedidoFornecedor({ fornecedor, requestedByName: actor.name, expectedAt, notes, items });
    pedidoNumber = result.pedidoNumber;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Não foi possível criar o pedido." };
  }

  revalidatePath("/assistencia/encomendas/fornecedores");
  redirect(`/assistencia/encomendas/fornecedores?enviado=1&pedido=${pedidoNumber}`);
}

async function getCurrentStatus(pedidoId: string): Promise<string> {
  const admin = getSupabaseAdmin();
  const { data: current, error } = await admin.from("pedidos_fornecedor").select("status").eq("id", pedidoId).single();
  if (error || !current) throw new Error("Pedido não encontrado.");
  return current.status;
}

export async function markPedidoFornecedorRecebido(pedidoId: string): Promise<void> {
  const actor = await requireFornecedorPedidoActor();
  const status = await getCurrentStatus(pedidoId);
  if (status !== "pedido_feito") throw new Error("Só é possível marcar como recebido um pedido ainda em aberto.");

  await updatePedidoFornecedorStatus(pedidoId, actor, status, "recebido");

  revalidatePath("/assistencia/encomendas/fornecedores");
  revalidatePath(`/assistencia/encomendas/fornecedores/${pedidoId}`);
}

export async function cancelPedidoFornecedor(pedidoId: string, reason: string): Promise<void> {
  const actor = await requireFornecedorPedidoActor();
  if (!reason.trim()) throw new Error("Informe o motivo do cancelamento.");

  const status = await getCurrentStatus(pedidoId);
  if (status !== "pedido_feito") throw new Error("Só é possível cancelar um pedido ainda em aberto.");

  await updatePedidoFornecedorStatus(pedidoId, actor, status, "cancelado", { note: reason.trim() });

  revalidatePath("/assistencia/encomendas/fornecedores");
  revalidatePath(`/assistencia/encomendas/fornecedores/${pedidoId}`);
}

export async function addPedidoFornecedorNoteAction(pedidoId: string, note: string): Promise<void> {
  const actor = await requireFornecedorPedidoActor();
  await addPedidoFornecedorNote(pedidoId, actor, note);
  revalidatePath(`/assistencia/encomendas/fornecedores/${pedidoId}`);
}

export async function setPedidoFornecedorExpectedAtAction(pedidoId: string, expectedAt: string | null): Promise<void> {
  const actor = await requireFornecedorPedidoActor();
  await setPedidoFornecedorExpectedAt(pedidoId, actor, expectedAt);
  revalidatePath(`/assistencia/encomendas/fornecedores/${pedidoId}`);
  revalidatePath("/assistencia/encomendas/fornecedores");
}
