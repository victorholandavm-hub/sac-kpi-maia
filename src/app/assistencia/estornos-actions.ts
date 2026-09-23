"use server";

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { resolveEstornoRequester } from "@/lib/estornoRequester";
import { createEstornoRequest } from "@/lib/estornoRequests";
import { uploadPendingRequestPhoto } from "@/lib/servicePhotos";
import { findTotvsClientByCode, type TotvsClientMatch } from "@/lib/totvsLookup";

export type EstornoFormState = { error?: string } | undefined;

// Código do cliente primeiro no formulário -- pedido do Victor 23/09/2026:
// puxa nome + CPF automaticamente, mesmo padrão de lookupTotvsClientForEncomenda
// (encomendas-actions.ts).
export async function lookupTotvsClientForEstorno(code: string): Promise<TotvsClientMatch | null> {
  const requester = await resolveEstornoRequester();
  if (!requester) return null;
  return findTotvsClientByCode(code);
}

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const str = String(value ?? "").trim();
  return str.length > 0 ? str : null;
}

// Formulário de solicitação de estorno (caixa/gerente) -- campos do print
// de referência do Victor (23/09/2026), + anexo obrigatório (foto ou PDF do
// comprovante da venda). Anexo sobe ANTES da linha existir (mesmo padrão de
// createSacRequest em servicePhotos.ts) -- se o upload falhar, nenhuma
// solicitação chega a ser criada.
export async function createEstornoRequestAction(_state: EstornoFormState, formData: FormData): Promise<EstornoFormState> {
  const requester = await resolveEstornoRequester();
  if (!requester) return { error: "Sessão expirada. Faça login de novo." };

  const storeId = requester.kind === "gerente" ? String(formData.get("store_id") ?? requester.storeIds[0]) : requester.storeId;
  if (requester.kind === "gerente" && !requester.storeIds.includes(storeId)) {
    return { error: "Loja inválida." };
  }

  const clienteNome = String(formData.get("cliente_nome") ?? "").trim();
  if (!clienteNome) return { error: "Informe o nome do cliente." };

  const valorRaw = String(formData.get("valor_reembolso") ?? "").replace(",", ".");
  const valorReembolso = Number(valorRaw);
  if (!Number.isFinite(valorReembolso) || valorReembolso <= 0) return { error: "Informe um valor de reembolso válido." };

  const file = formData.get("anexo");
  if (!(file instanceof File) || file.size === 0) return { error: "Anexe uma foto ou PDF do comprovante da venda." };

  const id = randomUUID();
  let anexoPath: string;
  try {
    anexoPath = await uploadPendingRequestPhoto(id, file);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Não foi possível enviar o anexo." };
  }

  try {
    await createEstornoRequest(id, {
      storeId,
      requesterRole: requester.kind,
      requesterName: requester.name,
      clienteNome,
      cpf: emptyToNull(formData.get("cpf")),
      codigoCliente: emptyToNull(formData.get("codigo_cliente")),
      nfEntrada: emptyToNull(formData.get("nf_entrada")),
      nfDevolucao: emptyToNull(formData.get("nf_devolucao")),
      valorReembolso,
      dataVenda: emptyToNull(formData.get("data_venda")),
      formaPagamento: emptyToNull(formData.get("forma_pagamento")),
      motivo: emptyToNull(formData.get("motivo")),
      produto: emptyToNull(formData.get("produto")),
      autorizadoPor: emptyToNull(formData.get("autorizado_por")),
      anexoSolicitacaoPath: anexoPath,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Não foi possível criar a solicitação." };
  }

  revalidatePath("/assistencia/estornos");
  redirect("/assistencia/estornos?enviado=1");
}
