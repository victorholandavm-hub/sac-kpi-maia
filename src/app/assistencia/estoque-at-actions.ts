"use server";

import { getProfile, requireRole } from "@/lib/dal";
import { estoqueAtLigado, faltasNoCd } from "@/lib/estoqueAt";

// AvisoSaldoCd (form do SAC): o que vai faltar no CD, pra o atendente confirmar antes de criar.
export async function faltasNoCdAction(itens: { codigo: string; qtd: number }[]): Promise<{ ligado: boolean; faltas: { codigo: string; nome: string; livre: number; qtd: number }[] }> {
  const profile = await getProfile();
  requireRole(profile, "admin", "sac", "assistencia");
  if (!estoqueAtLigado()) return { ligado: false, faltas: [] };
  return { ligado: true, faltas: await faltasNoCd(itens.slice(0, 30)).catch(() => []) };
}
