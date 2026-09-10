"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getProfile, requireRole } from "@/lib/dal";
import { isPartOrderStatus } from "@/lib/partOrders";
import { formatDateTimeBr } from "@/lib/formatDateTime";

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const str = String(value ?? "").trim();
  return str.length > 0 ? str : null;
}

export type PartOrderFormState = { error?: string; success?: boolean } | undefined;

export async function createPartOrder(_state: PartOrderFormState, formData: FormData): Promise<PartOrderFormState> {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin");

  const partName = String(formData.get("part_name") ?? "").trim();
  if (!partName) {
    return { error: "Informe a peça." };
  }

  const supplierChoice = String(formData.get("supplier") ?? "").trim();
  const supplierOther = String(formData.get("supplier_other") ?? "").trim();
  const supplier = supplierChoice === "__outro__" ? supplierOther : supplierChoice;
  const representative = emptyToNull(formData.get("representative"));
  const representativeEmail = emptyToNull(formData.get("representative_email"));
  const representativePhone = emptyToNull(formData.get("representative_phone"));

  const admin = getSupabaseAdmin();

  if (supplier) {
    // Mantém o contato do fornecedor sempre atualizado com o mais recente
    // digitado -- pedido do Victor 09/09/2026: é isso que alimenta o
    // autopreenchimento (listSupplierContacts, partOrders.ts) da próxima
    // vez que alguém escolher esse fornecedor num pedido novo. Só
    // sobrescreve quando o pedido atual trouxe algo preenchido -- não
    // apaga um contato já salvo só porque esse pedido específico deixou
    // o campo em branco.
    const supplierPatch: Record<string, string> = { name: supplier };
    if (representative) supplierPatch.representative = representative;
    if (representativeEmail) supplierPatch.representative_email = representativeEmail;
    if (representativePhone) supplierPatch.representative_phone = representativePhone;
    await admin.from("suppliers").upsert(supplierPatch, { onConflict: "name" });
  }

  const defaultExpectedAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Todo pedido novo continua a numeração da planilha "Solicitação de
  // peças" (CH0001..CH1643 no histórico importado) -- pedido do Victor
  // 09/09/2026: "se o ultimo chamado é o CH1643, o proximo deve ser o
  // CH1644". ch_number_seq (migration 0119) garante isso sem risco de
  // corrida entre duas criações ao mesmo tempo.
  const { data: chNumber, error: chError } = await admin.rpc("next_ch_number");
  if (chError) {
    return { error: `Não foi possível gerar o número do chamado: ${chError.message}` };
  }

  const { data, error } = await admin
    .from("part_orders")
    .insert({
      external_reference: chNumber,
      service_request_id: emptyToNull(formData.get("service_request_id")),
      client_name: emptyToNull(formData.get("client_name")),
      client_cpf: emptyToNull(formData.get("client_cpf")),
      client_phone: emptyToNull(formData.get("client_phone")),
      client_email: emptyToNull(formData.get("client_email")),
      product: emptyToNull(formData.get("product")),
      part_name: partName,
      part_code: emptyToNull(formData.get("part_code")),
      color: emptyToNull(formData.get("color")),
      supplier: supplier || null,
      representative,
      representative_email: representativeEmail,
      representative_phone: representativePhone,
      requested_by: profile.fullName,
      notes: emptyToNull(formData.get("notes")),
      expected_at: emptyToNull(formData.get("expected_at")) ?? defaultExpectedAt,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: `Não foi possível criar o pedido de peça: ${error?.message ?? "erro desconhecido"}` };
  }

  revalidatePath("/assistencia/pecas");
  return { success: true };
}

// Corrigir os dados de um pedido já criado -- pedido do Victor 10/09/2026:
// "preciso que tenha a opção de editar cada demanda". Mesmo padrão de
// updateRequestDetails (actions.ts, chamados de assistência): campos
// principais editáveis, redireciona pro detalhe ao salvar. `notes` FICA DE
// FORA de propósito -- addPartOrderNote trata esse campo como log
// (concatena "[data] texto" a cada nota), sobrescrever aqui apagaria o
// histórico acumulado por engano.
export async function updatePartOrder(id: string, _state: PartOrderFormState, formData: FormData): Promise<PartOrderFormState> {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin");

  const partName = String(formData.get("part_name") ?? "").trim();
  if (!partName) {
    return { error: "Informe a peça." };
  }

  const supplierChoice = String(formData.get("supplier") ?? "").trim();
  const supplierOther = String(formData.get("supplier_other") ?? "").trim();
  const supplier = supplierChoice === "__outro__" ? supplierOther : supplierChoice;
  const representative = emptyToNull(formData.get("representative"));
  const representativeEmail = emptyToNull(formData.get("representative_email"));
  const representativePhone = emptyToNull(formData.get("representative_phone"));

  const admin = getSupabaseAdmin();

  if (supplier) {
    const supplierPatch: Record<string, string> = { name: supplier };
    if (representative) supplierPatch.representative = representative;
    if (representativeEmail) supplierPatch.representative_email = representativeEmail;
    if (representativePhone) supplierPatch.representative_phone = representativePhone;
    await admin.from("suppliers").upsert(supplierPatch, { onConflict: "name" });
  }

  const { error } = await admin
    .from("part_orders")
    .update({
      client_name: emptyToNull(formData.get("client_name")),
      client_cpf: emptyToNull(formData.get("client_cpf")),
      client_phone: emptyToNull(formData.get("client_phone")),
      client_email: emptyToNull(formData.get("client_email")),
      product: emptyToNull(formData.get("product")),
      part_name: partName,
      part_code: emptyToNull(formData.get("part_code")),
      color: emptyToNull(formData.get("color")),
      supplier: supplier || null,
      representative,
      representative_email: representativeEmail,
      representative_phone: representativePhone,
    })
    .eq("id", id);

  if (error) {
    return { error: `Não foi possível salvar: ${error.message}` };
  }

  revalidatePath("/assistencia/pecas");
  revalidatePath(`/assistencia/pecas/${id}`);
  redirect(`/assistencia/pecas/${id}`);
}

// Extraído pra reaproveitar em updatePartOrderStatus (uma peça) e
// bulkUpdatePartOrderStatus (várias de uma vez, pedido do Victor
// 09/09/2026: "seleção em lote") -- mesmos carimbos de data nos dois casos,
// sem duplicar a regra.
function statusChangePatch(newStatus: string): Record<string, string> {
  const today = new Date().toISOString().slice(0, 10);
  const patch: Record<string, string> = { status: newStatus };
  if (newStatus === "peca_recebida") patch.part_arrived_at = today;
  if (newStatus === "enviada_ao_cliente") patch.sent_to_client_at = today;
  // Cancelada é terminal igual encerrado (pedido do Victor 09/09/2026) --
  // mesmo carimbo de closed_at, só o status que difere.
  if (newStatus === "encerrado" || newStatus === "cancelada") patch.closed_at = today;
  return patch;
}

export async function updatePartOrderStatus(id: string, newStatus: string) {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin");
  if (!isPartOrderStatus(newStatus)) throw new Error("Status inválido.");

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("part_orders").update(statusChangePatch(newStatus)).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/assistencia/pecas");
  revalidatePath(`/assistencia/pecas/${id}`);
}

// Seleção em lote (pedido do Victor 09/09/2026: "Adicionar um checkbox...
// para permitir a seleção em lote dos itens") -- um só update com `.in(...)`
// em vez de um round-trip por pedido selecionado.
export async function bulkUpdatePartOrderStatus(ids: string[], newStatus: string) {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin");
  if (!isPartOrderStatus(newStatus)) throw new Error("Status inválido.");
  if (ids.length === 0) return;

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("part_orders").update(statusChangePatch(newStatus)).in("id", ids);
  if (error) throw new Error(error.message);

  revalidatePath("/assistencia/pecas");
}

// Depois que a peça chega, "enviada ao cliente" e "caso encerrado" viram
// duas perguntas INDEPENDENTES em vez de um botão de cada vez em sequência
// -- pedido do Victor 09/09/2026, mesmo jeito que a planilha original já
// tratava esses dois campos (colunas separadas, não um status único
// avançando). Status final é derivado da combinação: encerrado (se
// marcado) vence enviada_ao_cliente, que vence peca_recebida -- mesma
// prioridade usada na importação do histórico (ver migration 0117).
// Recalcula as duas datas do zero a cada chamada (não só carimba na
// primeira vez) -- é um formulário de "estado atual", não um log de
// eventos: desmarcar deve conseguir limpar a data de novo.
export async function updatePartOrderDelivery(id: string, delivered: boolean, closed: boolean) {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin");

  const admin = getSupabaseAdmin();
  const { data: current, error: fetchError } = await admin
    .from("part_orders")
    .select("sent_to_client_at, closed_at")
    .eq("id", id)
    .maybeSingle();
  if (fetchError || !current) throw new Error("Pedido de peça não encontrado.");

  const today = new Date().toISOString().slice(0, 10);
  const status = closed ? "encerrado" : delivered ? "enviada_ao_cliente" : "peca_recebida";

  const { error } = await admin
    .from("part_orders")
    .update({
      status,
      sent_to_client_at: delivered ? (current.sent_to_client_at ?? today) : null,
      closed_at: closed ? (current.closed_at ?? today) : null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/assistencia/pecas");
  revalidatePath(`/assistencia/pecas/${id}`);
}

export async function setExpectedAt(id: string, newDate: string) {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin");
  if (!newDate) throw new Error("Informe uma data.");

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("part_orders").update({ expected_at: newDate }).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/assistencia/pecas");
  revalidatePath(`/assistencia/pecas/${id}`);
}

export async function addPartOrderNote(id: string, note: string) {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin");
  const trimmed = note.trim();
  if (!trimmed) throw new Error("Nota vazia.");

  const admin = getSupabaseAdmin();
  const { data: current, error: fetchError } = await admin.from("part_orders").select("notes").eq("id", id).single();
  if (fetchError || !current) throw new Error("Pedido de peça não encontrado.");

  const stamp = formatDateTimeBr(new Date().toISOString());
  const appended = current.notes ? `${current.notes}\n[${stamp}] ${trimmed}` : `[${stamp}] ${trimmed}`;

  const { error } = await admin.from("part_orders").update({ notes: appended }).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath(`/assistencia/pecas/${id}`);
}
