"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getProfile, requireRole } from "@/lib/dal";
import { createReclamacao, updateReclamacao, type ReclamacaoInput } from "@/lib/reclamacoes";

export type ReclamacaoFormState = { error?: string } | undefined;

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const str = String(value ?? "").trim();
  return str.length > 0 ? str : null;
}

// Datetime-local (input type="datetime-local", sem timezone) -- assume
// horário de Brasília, mesma zona usada em todo o resto do app (ver
// parse_audiencia do import original, sempre "-03").
function parseAudiencia(value: FormDataEntryValue | null): string | null {
  const str = String(value ?? "").trim();
  if (!str) return null;
  return `${str}:00-03:00`;
}

function readInput(formData: FormData): ReclamacaoInput | { error: string } {
  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) return { error: "Informe o nome." };
  const orgao = String(formData.get("orgao") ?? "").trim();
  if (!orgao) return { error: "Informe o órgão." };
  const statusInterno = String(formData.get("status_interno") ?? "").trim();
  if (!statusInterno) return { error: "Informe o status." };

  return {
    nome,
    cpf: emptyToNull(formData.get("cpf")),
    orgao,
    dataRecebimento: emptyToNull(formData.get("data_recebimento")),
    statusInterno,
    statusExterno: emptyToNull(formData.get("status_externo")),
    dataAudiencia: parseAudiencia(formData.get("data_audiencia")),
    documentos: emptyToNull(formData.get("documentos")),
    recebidoPor: emptyToNull(formData.get("recebido_por")),
    observacoes: emptyToNull(formData.get("observacoes")),
  };
}

export async function createReclamacaoAction(_state: ReclamacaoFormState, formData: FormData): Promise<ReclamacaoFormState> {
  const profile = await getProfile();
  requireRole(profile, "admin");

  const input = readInput(formData);
  if ("error" in input) return input;

  try {
    await createReclamacao(input);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Não foi possível salvar a reclamação." };
  }

  revalidatePath("/assistencia/reclamacoes");
  redirect("/assistencia/reclamacoes?salvo=1");
}

export async function updateReclamacaoAction(id: string, _state: ReclamacaoFormState, formData: FormData): Promise<ReclamacaoFormState> {
  const profile = await getProfile();
  requireRole(profile, "admin");

  const input = readInput(formData);
  if ("error" in input) return input;

  try {
    await updateReclamacao(id, input);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Não foi possível salvar a reclamação." };
  }

  revalidatePath("/assistencia/reclamacoes");
  revalidatePath(`/assistencia/reclamacoes/${id}/editar`);
  redirect("/assistencia/reclamacoes?salvo=1");
}
