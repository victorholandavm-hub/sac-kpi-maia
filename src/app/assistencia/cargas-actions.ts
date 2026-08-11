"use server";

import { revalidatePath } from "next/cache";
import { getProfile, requireRole } from "@/lib/dal";
import { addCargaProblema } from "@/lib/cargas";

export async function addCargaProblemaAction(cargaRowId: string, description: string): Promise<void> {
  const profile = await getProfile();
  requireRole(profile, "sac", "admin");

  await addCargaProblema(cargaRowId, description, { id: profile.id, name: profile.fullName, role: profile.role as "sac" | "admin" });

  revalidatePath("/assistencia/sac/cargas");
}
