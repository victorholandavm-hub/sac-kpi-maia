"use server";

import { revalidatePath } from "next/cache";
import { getProfile, requireRole } from "@/lib/dal";
import { createArsenalEntry, updateArsenalEntry, setArsenalEntryActive, isArsenalCategory, type ArsenalCategory } from "@/lib/arsenalSac";

const ARSENAL_PATH = "/assistencia/sac/arsenal";

type ArsenalEntryFormInput = { category: string; title: string; body: string; keywords: string | null };

function validate(input: ArsenalEntryFormInput): { category: ArsenalCategory; title: string; body: string; keywords: string | null } {
  if (!isArsenalCategory(input.category)) throw new Error("Categoria inválida.");
  if (!input.title.trim()) throw new Error("Informe o título.");
  if (!input.body.trim()) throw new Error("Informe o conteúdo.");
  return { category: input.category, title: input.title, body: input.body, keywords: input.keywords };
}

export async function createArsenalEntryAction(input: ArsenalEntryFormInput): Promise<void> {
  const profile = await getProfile();
  requireRole(profile, "admin");
  await createArsenalEntry(validate(input));
  revalidatePath(ARSENAL_PATH);
}

export async function updateArsenalEntryAction(id: string, input: ArsenalEntryFormInput): Promise<void> {
  const profile = await getProfile();
  requireRole(profile, "admin");
  await updateArsenalEntry(id, validate(input));
  revalidatePath(ARSENAL_PATH);
}

export async function setArsenalEntryActiveAction(id: string, active: boolean): Promise<void> {
  const profile = await getProfile();
  requireRole(profile, "admin");
  await setArsenalEntryActive(id, active);
  revalidatePath(ARSENAL_PATH);
}
