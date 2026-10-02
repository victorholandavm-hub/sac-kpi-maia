"use server";

import { revalidatePath } from "next/cache";
import { getProfile, requireRole } from "@/lib/dal";
import {
  addCadastroHistorico,
  updateCadastroHistorico,
  CADASTRO_TIPOS,
  CADASTRO_STATUSES,
  type CadastroTipo,
  type CadastroStatus,
} from "@/lib/cadastrosHistorico";

export type FormState = { error?: string } | undefined;

function emptyToNull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s || null;
}

// Mesmo acesso da tela (ver redirectIfSac em cadastros/page.tsx) -- SAC não
// mexe em histórico de assistência, só admin/assistência.
export async function addCadastroHistoricoAction(_state: FormState, formData: FormData): Promise<FormState> {
  const profile = await getProfile();
  requireRole(profile, "admin", "assistencia");

  const tipo = String(formData.get("tipo") ?? "");
  if (!(CADASTRO_TIPOS as readonly string[]).includes(tipo)) {
    return { error: "Selecione a solicitação." };
  }

  const produto = String(formData.get("produto") ?? "").trim();
  if (!produto) return { error: "Informe o produto." };

  const cliente = String(formData.get("cliente") ?? "").trim();
  if (!cliente) return { error: "Informe o cliente." };

  try {
    await addCadastroHistorico({
      tipo: tipo as CadastroTipo,
      codigo: emptyToNull(formData.get("codigo")),
      produto,
      descricao: emptyToNull(formData.get("descricao")),
      nf: emptyToNull(formData.get("nf")),
      vendedora: emptyToNull(formData.get("vendedora")),
      loja: emptyToNull(formData.get("loja")),
      cnpj: emptyToNull(formData.get("cnpj")),
      cliente,
      endereco: emptyToNull(formData.get("endereco")),
      cpf: emptyToNull(formData.get("cpf")),
      telefone: emptyToNull(formData.get("telefone")),
      dataAbertura: emptyToNull(formData.get("data")),
      solicitante: emptyToNull(formData.get("solicitante")) ?? profile.fullName,
      prazoData: emptyToNull(formData.get("prazo")),
      quemMontou: emptyToNull(formData.get("quemMontou")),
      obs: emptyToNull(formData.get("obs")),
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Não foi possível salvar o cadastro." };
  }

  revalidatePath("/assistencia/cadastros");
  return undefined;
}

// Edição vale pros dois casos -- registro importado da planilha original OU
// lançado pelo sistema (addCadastroHistoricoAction acima), mesma tabela.
// Mesmo gate de acesso.
export async function updateCadastroHistoricoAction(_state: FormState, formData: FormData): Promise<FormState> {
  const profile = await getProfile();
  requireRole(profile, "admin", "assistencia");

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Cadastro inválido." };

  const tipo = String(formData.get("tipo") ?? "");
  if (!(CADASTRO_TIPOS as readonly string[]).includes(tipo)) {
    return { error: "Selecione a solicitação." };
  }

  const status = String(formData.get("status") ?? "");
  if (!(CADASTRO_STATUSES as readonly string[]).includes(status)) {
    return { error: "Selecione a situação." };
  }

  const produto = String(formData.get("produto") ?? "").trim();
  if (!produto) return { error: "Informe o produto." };

  const cliente = String(formData.get("cliente") ?? "").trim();
  if (!cliente) return { error: "Informe o cliente." };

  try {
    await updateCadastroHistorico(id, {
      tipo: tipo as CadastroTipo,
      codigo: emptyToNull(formData.get("codigo")),
      produto,
      descricao: emptyToNull(formData.get("descricao")),
      nf: emptyToNull(formData.get("nf")),
      vendedora: emptyToNull(formData.get("vendedora")),
      loja: emptyToNull(formData.get("loja")),
      cnpj: emptyToNull(formData.get("cnpj")),
      cliente,
      endereco: emptyToNull(formData.get("endereco")),
      cpf: emptyToNull(formData.get("cpf")),
      telefone: emptyToNull(formData.get("telefone")),
      dataAbertura: emptyToNull(formData.get("data")),
      solicitante: emptyToNull(formData.get("solicitante")),
      prazoData: emptyToNull(formData.get("prazo")),
      quemMontou: emptyToNull(formData.get("quemMontou")),
      obs: emptyToNull(formData.get("obs")),
      status: status as CadastroStatus,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Não foi possível salvar as alterações." };
  }

  revalidatePath("/assistencia/cadastros");
  return undefined;
}
