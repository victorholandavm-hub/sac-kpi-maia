"use server";

import { revalidatePath } from "next/cache";
import { getProfile, requireRole } from "@/lib/dal";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { addCronogramaItem, setCronogramaItemAtivo, todayFortaleza } from "@/lib/cronogramaSac";

export type FormState = { error?: string } | undefined;

// Só o próprio atendente (role "sac") marca o próprio checklist -- nunca
// em nome de outro (ver profile.id abaixo, não um id vindo do form), e só
// o dia de HOJE (data sempre calculada no servidor, nunca recebida do
// cliente) -- pedido implícito do Victor: "controlar diariamente" só faz
// sentido se o atendente não puder voltar e marcar um dia passado como
// feito depois do fato.
export async function markCronogramaItemDone(itemId: string): Promise<void> {
  const profile = await getProfile();
  requireRole(profile, "sac");

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("sac_cronograma_completions")
    .upsert({ item_id: itemId, profile_id: profile.id, data: todayFortaleza() }, { onConflict: "item_id,profile_id,data" });
  if (error) throw new Error(error.message);

  revalidatePath("/assistencia/sac/cronograma");
}

// Desmarcar -- corrige engano (marcou errado), mesma trava de só hoje/só
// o próprio.
export async function unmarkCronogramaItemDone(itemId: string): Promise<void> {
  const profile = await getProfile();
  requireRole(profile, "sac");

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("sac_cronograma_completions")
    .delete()
    .eq("item_id", itemId)
    .eq("profile_id", profile.id)
    .eq("data", todayFortaleza());
  if (error) throw new Error(error.message);

  revalidatePath("/assistencia/sac/cronograma");
}

// CRUD dos itens do cronograma -- só admin (ver AdminSection "Cronograma
// do SAC", admin/page.tsx). Mesmo padrão de addProdutoEncomenda/
// toggleProdutoEncomendaAtivo (admin-actions.ts).
export async function addCronogramaItemAction(_state: FormState, formData: FormData): Promise<FormState> {
  const profile = await getProfile();
  requireRole(profile, "admin");

  const horario = String(formData.get("horario") ?? "").trim();
  if (!horario) return { error: "Informe o horário." };
  const descricao = String(formData.get("descricao") ?? "").trim();
  if (!descricao) return { error: "Informe a descrição." };

  try {
    await addCronogramaItem(horario, descricao);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Não foi possível salvar o item." };
  }

  revalidatePath("/assistencia/admin");
  revalidatePath("/assistencia/sac/cronograma");
  return undefined;
}

export async function toggleCronogramaItemAtivoAction(id: string, ativo: boolean): Promise<void> {
  const profile = await getProfile();
  requireRole(profile, "admin");
  await setCronogramaItemAtivo(id, ativo);
  revalidatePath("/assistencia/admin");
  revalidatePath("/assistencia/sac/cronograma");
}
