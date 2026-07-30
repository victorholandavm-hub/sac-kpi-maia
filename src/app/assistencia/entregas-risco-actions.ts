"use server";

import { revalidatePath } from "next/cache";
import { getProfile, requireRole } from "@/lib/dal";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { classifyEntregaRisco, assignEntregaRisco } from "@/lib/entregasRisco";

export async function classifyEntregaRiscoAction(
  pedido: string,
  filialVenda: string,
  input: { note: string | null; reavaliarEm: string | null }
): Promise<void> {
  const profile = await getProfile();
  requireRole(profile, "sac", "admin");

  await classifyEntregaRisco(pedido, filialVenda, { name: profile.fullName, role: profile.role }, input);

  revalidatePath("/assistencia/sac/entregas-risco");
  revalidatePath("/assistencia/sac");
}

export async function assignEntregaRiscoAction(pedido: string, filialVenda: string, assignedToId: string | null): Promise<void> {
  const profile = await getProfile();
  requireRole(profile, "sac", "admin");

  let assignedTo: { id: string; name: string } | null = null;
  if (assignedToId) {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.from("profiles").select("id, full_name").eq("id", assignedToId).maybeSingle();
    if (error || !data) throw new Error("Atendente não encontrado.");
    assignedTo = { id: data.id, name: data.full_name };
  }

  await assignEntregaRisco(pedido, filialVenda, { name: profile.fullName, role: profile.role }, assignedTo);

  revalidatePath("/assistencia/sac/entregas-risco");
  revalidatePath("/assistencia/sac");
}
