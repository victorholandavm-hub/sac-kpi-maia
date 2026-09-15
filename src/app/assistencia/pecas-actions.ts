"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isPartOrderStatus } from "@/lib/partOrders";
import { formatDateTimeBr } from "@/lib/formatDateTime";
import { requirePecasActor } from "@/lib/pecasAccess";

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const str = String(value ?? "").trim();
  return str.length > 0 ? str : null;
}

// A partir de 14/09/2026 a equipe técnica também gerencia pedidos de peça,
// só que numa rota própria (/assistencia/tecnico/pecas, visual denso igual
// fila/estoque -- "fica ruim se for compartilhada a mesma tela da
// assistencia", achado do Victor) -- as ações abaixo continuam as mesmas
// pras duas rotas (requirePecasActor já cobre os dois mundos), só a
// revalidação/redirecionamento precisam saber dos dois caminhos.
function revalidatePecasPaths(id?: string) {
  revalidatePath("/assistencia/pecas");
  revalidatePath("/assistencia/tecnico/pecas");
  if (id) {
    revalidatePath(`/assistencia/pecas/${id}`);
    revalidatePath(`/assistencia/tecnico/pecas/${id}`);
  }
}

export type PartOrderFormState = { error?: string; success?: boolean } | undefined;

export async function createPartOrder(_state: PartOrderFormState, formData: FormData): Promise<PartOrderFormState> {
  const actor = await requirePecasActor();

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
  // corrida entre duas criações ao mesmo tempo. Formatação ("CH" + zero à
  // esquerda) sai do banco e vem pra cá (migration 0122) -- lpad truncou
  // em vez de só preencher (0121 corrigiu isso e AINDA ASSIM aconteceu de
  // novo, achado do Victor 10/09/2026 -- sem confirmar a causa exata,
  // tirar a formatação de string do banco de vez é a saída mais segura).
  // padStart do JS nunca trunca, só preenche quando é menor.
  const { data: chSeq, error: chError } = await admin.rpc("next_ch_seq");
  if (chError) {
    return { error: `Não foi possível gerar o número do chamado: ${chError.message}` };
  }
  const chNumber = `CH${String(chSeq).padStart(3, "0")}`;

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
      requested_by: actor.name,
      notes: emptyToNull(formData.get("notes")),
      expected_at: emptyToNull(formData.get("expected_at")) ?? defaultExpectedAt,
      invoice_number: emptyToNull(formData.get("invoice_number")),
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: `Não foi possível criar o pedido de peça: ${error?.message ?? "erro desconhecido"}` };
  }

  revalidatePecasPaths();
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
  const actor = await requirePecasActor();

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
      invoice_number: emptyToNull(formData.get("invoice_number")),
    })
    .eq("id", id);

  if (error) {
    return { error: `Não foi possível salvar: ${error.message}` };
  }

  revalidatePecasPaths(id);
  // Volta pra rota de quem editou -- rota própria da equipe técnica desde
  // 14/09/2026 (ver revalidatePecasPaths acima).
  redirect(actor.role === "tecnico" ? `/assistencia/tecnico/pecas/${id}` : `/assistencia/pecas/${id}`);
}

// Extraído pra reaproveitar em updatePartOrderStatus (uma peça) e
// bulkUpdatePartOrderStatus (várias de uma vez, pedido do Victor
// 09/09/2026: "seleção em lote") -- mesmos carimbos de data nos dois casos,
// sem duplicar a regra. `actor` é opcional só pra não quebrar a assinatura
// se algum dia chamado sem ator disponível -- os dois usos atuais sempre
// passam.
function statusChangePatch(newStatus: string, actor?: { name: string }): Record<string, string> {
  const today = new Date().toISOString().slice(0, 10);
  const patch: Record<string, string> = { status: newStatus };
  // "devolvida_ao_estoque" também carimba part_arrived_at -- pular direto
  // pra esse status (ex.: via PartOrderQuickStatus, sem passar pelas 2
  // perguntas de updatePartOrderDelivery) ainda significa que a peça
  // chegou fisicamente (pedido do Victor 14/09/2026, migration 0126).
  if (newStatus === "peca_recebida" || newStatus === "devolvida_ao_estoque") patch.part_arrived_at = today;
  if (newStatus === "enviada_ao_cliente") patch.sent_to_client_at = today;
  // Cancelada/devolvida_ao_estoque são terminais igual encerrado (pedido
  // do Victor 09/09/2026 e 14/09/2026) -- mesmo carimbo de closed_at, só o
  // status que difere.
  if (newStatus === "encerrado" || newStatus === "cancelada" || newStatus === "devolvida_ao_estoque") patch.closed_at = today;
  // Chegar em "devolvida_ao_estoque" por qualquer caminho já registra
  // "caso resolvido sem esta peça" sozinho, se ainda não tivesse sido
  // marcado antes (ver markResolvedWithoutPart abaixo) -- não faz sentido
  // ter esse status sem essa marca.
  if (newStatus === "devolvida_ao_estoque" && actor) {
    patch.resolved_without_part_at = new Date().toISOString();
    patch.resolved_without_part_by = actor.name;
  }
  return patch;
}

export async function updatePartOrderStatus(id: string, newStatus: string) {
  const actor = await requirePecasActor();
  if (!isPartOrderStatus(newStatus)) throw new Error("Status inválido.");

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("part_orders").update(statusChangePatch(newStatus, actor)).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePecasPaths(id);
}

// Seleção em lote (pedido do Victor 09/09/2026: "Adicionar um checkbox...
// para permitir a seleção em lote dos itens") -- um só update com `.in(...)`
// em vez de um round-trip por pedido selecionado.
export async function bulkUpdatePartOrderStatus(ids: string[], newStatus: string) {
  const actor = await requirePecasActor();
  if (!isPartOrderStatus(newStatus)) throw new Error("Status inválido.");
  if (ids.length === 0) return;

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("part_orders").update(statusChangePatch(newStatus, actor)).in("id", ids);
  if (error) throw new Error(error.message);

  revalidatePecasPaths();
}

// Depois que a peça chega, o desfecho vira uma escolha de 3 caminhos --
// pedido do Victor 09/09/2026 (originalmente "entregue ao cliente"/"caso
// encerrado" como duas perguntas independentes, mesmo jeito que a planilha
// original tratava esses dois campos) ampliado em 14/09/2026: "às vezes
// consegue a peça por outros meios... e essa peça que chega em nome do
// cliente, volta pro estoque". `outcome` escolhe entre pendente/entregue/
// devolvida ao estoque (mutuamente exclusivos -- não dá pra estar nos dois
// ao mesmo tempo); "Caso encerrado?" continua uma pergunta À PARTE, só faz
// sentido em cima de "entregue" (devolvida ao estoque já é terminal
// sozinha, pendente não tem o que encerrar). Status final: devolvida ao
// estoque > encerrado (se marcado) > enviada_ao_cliente > peca_recebida --
// mesma prioridade em espírito da importação do histórico (migration
// 0117). Recalcula os campos do zero a cada chamada (não só carimba na
// primeira vez) -- é um formulário de "estado atual", não um log de
// eventos: trocar de outcome deve conseguir limpar o anterior.
export type PartOrderDeliveryOutcome = "pendente" | "entregue" | "devolvida_estoque";

export async function updatePartOrderDelivery(id: string, outcome: PartOrderDeliveryOutcome, closed: boolean) {
  const actor = await requirePecasActor();

  const admin = getSupabaseAdmin();
  const { data: current, error: fetchError } = await admin
    .from("part_orders")
    .select("sent_to_client_at, closed_at, resolved_without_part_at")
    .eq("id", id)
    .maybeSingle();
  if (fetchError || !current) throw new Error("Pedido de peça não encontrado.");

  const today = new Date().toISOString().slice(0, 10);
  const isReturned = outcome === "devolvida_estoque";
  const isDelivered = outcome === "entregue";
  const status = isReturned ? "devolvida_ao_estoque" : closed ? "encerrado" : isDelivered ? "enviada_ao_cliente" : "peca_recebida";

  const patch: Record<string, string | null> = {
    status,
    sent_to_client_at: isDelivered ? (current.sent_to_client_at ?? today) : null,
    closed_at: isReturned || closed ? (current.closed_at ?? today) : null,
  };
  // Devolver ao estoque sem ter passado antes por "marcar resolvido sem
  // esta peça" (ex.: só percebeu agora, na hora que a peça chegou) --
  // registra a marca sozinho, pra não ficar devolvida_ao_estoque sem essa
  // informação (ver markResolvedWithoutPart abaixo).
  if (isReturned && !current.resolved_without_part_at) {
    patch.resolved_without_part_at = new Date().toISOString();
    patch.resolved_without_part_by = actor.name;
  }

  const { error } = await admin.from("part_orders").update(patch).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePecasPaths(id);
}

export async function setExpectedAt(id: string, newDate: string) {
  await requirePecasActor();
  if (!newDate) throw new Error("Informe uma data.");

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("part_orders").update({ expected_at: newDate }).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePecasPaths(id);
}

// Diferenciação CASO x PEÇA -- pedido do Victor 14/09/2026: às vezes a
// assistência resolve o cliente por outro meio antes da peça pedida à
// fábrica chegar (e encerra o atendimento dele), mas o pedido de peça em
// si continua até a peça chegar de verdade, só que agora sem cliente
// esperando por ela. Ação independente de status -- só registra o fato
// "esse caso já foi resolvido sem esta peça", sem mexer no fluxo normal de
// chegada (aguardando_peca -> peca_recebida continua rolando igual). É
// updatePartOrderDelivery (acima) quem, na hora que a peça chega de
// verdade, passa a oferecer "devolvida ao estoque" como desfecho em vez de
// "entregue ao cliente". Bloqueado depois que o pedido já tem um desfecho
// (entregue/encerrado/cancelado/devolvido) -- nesse ponto não faz mais
// sentido "resolver sem a peça" algo que já terminou.
const BLOCKED_FOR_RESOLVED_WITHOUT_PART = ["enviada_ao_cliente", "encerrado", "cancelada", "devolvida_ao_estoque"];

export async function markResolvedWithoutPart(id: string) {
  const actor = await requirePecasActor();
  const admin = getSupabaseAdmin();
  const { data: current, error: fetchError } = await admin.from("part_orders").select("status").eq("id", id).maybeSingle();
  if (fetchError || !current) throw new Error("Pedido de peça não encontrado.");
  if (BLOCKED_FOR_RESOLVED_WITHOUT_PART.includes(current.status)) {
    throw new Error("Esse pedido já tem um desfecho -- não faz sentido marcar agora.");
  }

  const { error } = await admin
    .from("part_orders")
    .update({ resolved_without_part_at: new Date().toISOString(), resolved_without_part_by: actor.name })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePecasPaths(id);
}

export async function unmarkResolvedWithoutPart(id: string) {
  await requirePecasActor();
  const admin = getSupabaseAdmin();

  const { error } = await admin
    .from("part_orders")
    .update({ resolved_without_part_at: null, resolved_without_part_by: null })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePecasPaths(id);
}

// "Peça chegou em" / "Enviada ao cliente em" editáveis à mão -- pedido do
// Victor 14/09/2026: "preciso que tanto assistencia quanto equipe técnica
// possam editar a data de chegada da peça e data enviada para o
// cliente... preciso que tenha historico em cada uma delas". Antes essas
// duas datas só eram carimbadas de forma automática numa troca de status
// (statusChangePatch/updatePartOrderDelivery acima) -- continuam sendo
// (esse comportamento não mudou), só que agora também dá pra CORRIGIR à
// mão direto, sem precisar desfazer/refazer o status inteiro só pra
// ajustar uma data digitada errado. Independente de status de propósito
// (só muda a data, igual setExpectedAt acima) -- mexer no status também
// tem seu próprio fluxo já pronto (PartOrderQuickStatus/PartOrderActions),
// essa aqui é só "essa data tá errada, corrige". Aceita `newDate` vazio
// pra LIMPAR a data (desfazer um carimbo colocado por engano) -- diferente
// de setExpectedAt (SLA sempre precisa de algum valor), aqui "não
// aconteceu ainda" é um estado válido.
async function updateDateFieldWithHistory(id: string, field: "part_arrived_at" | "sent_to_client_at", newDate: string) {
  const actor = await requirePecasActor();
  const admin = getSupabaseAdmin();

  const { data: current, error: fetchError } = await admin.from("part_orders").select(field).eq("id", id).maybeSingle();
  if (fetchError || !current) throw new Error("Pedido de peça não encontrado.");

  const oldValue = (current as Record<string, string | null>)[field];
  const newValue = newDate || null;
  if (oldValue === newValue) return; // nada mudou -- sem linha de histórico à toa

  const { error } = await admin
    .from("part_orders")
    .update({ [field]: newValue })
    .eq("id", id);
  if (error) throw new Error(error.message);

  await admin.from("part_order_field_history").insert({
    part_order_id: id,
    field,
    old_value: oldValue,
    new_value: newValue,
    changed_by: actor.name,
    changed_by_role: actor.role,
  });

  revalidatePecasPaths(id);
}

export async function updatePartArrivedAt(id: string, newDate: string) {
  await updateDateFieldWithHistory(id, "part_arrived_at", newDate);
}

export async function updateSentToClientAt(id: string, newDate: string) {
  await updateDateFieldWithHistory(id, "sent_to_client_at", newDate);
}

export async function addPartOrderNote(id: string, note: string) {
  await requirePecasActor();
  const trimmed = note.trim();
  if (!trimmed) throw new Error("Nota vazia.");

  const admin = getSupabaseAdmin();
  const { data: current, error: fetchError } = await admin.from("part_orders").select("notes").eq("id", id).single();
  if (fetchError || !current) throw new Error("Pedido de peça não encontrado.");

  const stamp = formatDateTimeBr(new Date().toISOString());
  const appended = current.notes ? `${current.notes}\n[${stamp}] ${trimmed}` : `[${stamp}] ${trimmed}`;

  const { error } = await admin.from("part_orders").update({ notes: appended }).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePecasPaths(id);
}
