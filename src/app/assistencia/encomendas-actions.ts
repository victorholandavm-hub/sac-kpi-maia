"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireEncomendaAction } from "@/lib/dal";
import { requireEncomendaActor } from "@/lib/encomendaAuth";
import { resolveEncomendaRequester, canEditPedido } from "@/lib/encomendaRequester";
import { getClientIp, checkAndRecordPublicSubmission } from "@/lib/rateLimit";
import { INTERNAL_FABRICAS, EXTERNAL_FABRICAS } from "@/lib/fabricas";
import {
  createPedidoEncomenda,
  updatePedidoStatus,
  updatePedidoEncomendaContent,
  updatePedidoFornecedor,
  undoLastPedidoStatusChange,
  addPedidoNote,
  setPedidoPrazoEtapa,
  isPedidoEncomendaStatus,
  type NewPedidoEncomendaItem,
} from "@/lib/pedidosEncomenda";
import { saveEncomendaPhoto } from "@/lib/pedidoEncomendaPhotos";
import { notifyTelegramNewEncomenda } from "@/lib/telegram";
import {
  searchTotvsOrdersByInvoice,
  findTotvsClientByCode,
  findTotvsProductByCode,
  type TotvsOrderSuggestion,
  type TotvsClientMatch,
  type TotvsProductMatch,
} from "@/lib/totvsLookup";

export type FormState = { error?: string } | undefined;

// Sugestão de NF-e ao informar faturamento da encomenda -- não valida, só
// ajuda a achar a NF certa (ver PedidoEncomendaActions.tsx).
export async function searchNfSuggestions(query: string, storeId: string): Promise<TotvsOrderSuggestion[]> {
  await requireEncomendaActor();
  return searchTotvsOrdersByInvoice(query, storeId);
}

// Não existe campo de nome nessa tabela (só guarda o código digitado) -- isso
// é só pra mostrar de quem é o código antes de enviar, pra pegar erro de
// digitação, sem travar o envio se não achar.
export async function lookupTotvsClientForEncomenda(code: string): Promise<TotvsClientMatch | null> {
  const requester = await resolveEncomendaRequester();
  if (!requester) return null;
  return findTotvsClientByCode(code);
}

// Mesma ideia, pro código do produto de cada item do pedido -- autopreenche
// a descrição (ver ProductItemsFields em NovoPedidoEncomendaForm.tsx).
export async function lookupTotvsProductForEncomenda(code: string): Promise<TotvsProductMatch | null> {
  const requester = await resolveEncomendaRequester();
  if (!requester) return null;
  return findTotvsProductByCode(code);
}

// Caixa, vendedor ou gerente lançam o pedido direto (formulário, sem
// foto/WhatsApp) — gated por resolveEncomendaRequester (src/lib/encomendaRequester.ts),
// que tenta as três sessões em sequência. Caixa/vendedor resolvem pra uma
// loja só; gerente com mais de uma loja escolhe no formulário (validado
// contra as lojas dele, nunca confiando cegamente no valor do form).
export async function createPedidoEncomendaAction(_state: FormState, formData: FormData): Promise<FormState> {
  const ip = await getClientIp();
  const { allowed } = await checkAndRecordPublicSubmission(ip);
  if (!allowed) {
    return { error: "Muitas solicitações enviadas em pouco tempo. Aguarde alguns minutos e tente de novo." };
  }

  const requester = await resolveEncomendaRequester();
  if (!requester) return { error: "Sessão expirada. Faça login de novo." };

  let storeId: string;
  const requestedByName = requester.name;
  if (requester.kind === "gerente") {
    const chosenStoreId = String(formData.get("store_id") ?? "").trim();
    if (requester.storeIds.length === 1) {
      storeId = requester.storeIds[0];
    } else {
      if (!requester.storeIds.includes(chosenStoreId)) return { error: "Selecione uma loja válida." };
      storeId = chosenStoreId;
    }
  } else if (requester.kind === "cd" || requester.kind === "fabrica" || requester.kind === "sac") {
    // CD/fábrica/SAC não têm loja fixa — escolhem na hora de lançar o
    // pedido, dentre todas as lojas (ver solicitar/page.tsx). Validado
    // abaixo contra a tabela stores, igual já acontece pros outros papéis.
    const chosenStoreId = String(formData.get("store_id") ?? "").trim();
    if (!chosenStoreId) return { error: "Selecione a loja do pedido." };
    storeId = chosenStoreId;
  } else {
    storeId = requester.storeId;
  }

  const admin = getSupabaseAdmin();
  const { data: store } = await admin.from("stores").select("name").eq("id", storeId).maybeSingle();
  if (!store) return { error: "Loja inválida." };

  // Fornecedor: quem já é operador de fábrica de uma fábrica só lança
  // pedido pra ela mesma (não escolhe no formulário — ver campo fixo em
  // NovoPedidoEncomendaForm.tsx); nunca fornecedor externo, mesmo quando
  // (como o Rafael) enxerga as duas fábricas próprias -- nesse caso ele
  // escolhe qual das duas no formulário, mas a opção externa nem aparece
  // (allowExternal=false em solicitar/page.tsx). Os demais (gerente/caixa/CD)
  // escolhem entre as duas fábricas próprias ou um fornecedor externo,
  // sempre validado contra as listas fixas, nunca confiando cegamente no
  // formData.
  let fornecedorTipo: "fabrica_interna" | "fabrica_externa";
  let fabricaId: string | null = null;
  let fornecedorExterno: string | null = null;
  if (requester.kind === "fabrica") {
    fornecedorTipo = "fabrica_interna";
    if (requester.fabricaId) {
      fabricaId = requester.fabricaId;
    } else {
      const rawFabricaId = String(formData.get("fabrica_id") ?? "");
      if (!INTERNAL_FABRICAS.some((f) => f.id === rawFabricaId)) return { error: "Selecione a fábrica do pedido." };
      fabricaId = rawFabricaId;
    }
  } else {
    const rawTipo = String(formData.get("fornecedor_tipo") ?? "");
    if (rawTipo === "fabrica_externa") {
      const rawExterno = String(formData.get("fornecedor_externo") ?? "").trim();
      if (!EXTERNAL_FABRICAS.includes(rawExterno)) return { error: "Selecione um fornecedor externo válido." };
      fornecedorTipo = "fabrica_externa";
      fornecedorExterno = rawExterno;
    } else {
      const rawFabricaId = String(formData.get("fabrica_id") ?? "");
      if (!INTERNAL_FABRICAS.some((f) => f.id === rawFabricaId)) return { error: "Selecione a fábrica do pedido." };
      fornecedorTipo = "fabrica_interna";
      fabricaId = rawFabricaId;
    }
  }

  const vendedorName = String(formData.get("vendedor_name") ?? "").trim() || null;
  const clienteCodigo = String(formData.get("cliente_codigo") ?? "").trim() || null;
  if (!clienteCodigo) return { error: "Informe o código do cliente." };

  const produtoDescricoes = formData.getAll("item_produto_descricao").map((v) => String(v).trim());
  const produtoCodigos = formData.getAll("item_produto_codigo").map((v) => String(v).trim() || null);
  const quantidades = formData.getAll("item_quantidade").map((v) => {
    const n = parseInt(String(v), 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
  });
  const items: NewPedidoEncomendaItem[] = produtoDescricoes
    .map((produtoDescricao, i) => ({ produtoDescricao, produtoCodigo: produtoCodigos[i] ?? null, quantidade: quantidades[i] ?? 1 }))
    .filter((item) => item.produtoDescricao.length > 0);

  if (items.length === 0) {
    return { error: "Adicione pelo menos um produto." };
  }

  const cupomFiscal = formData.get("cupom_fiscal");
  if (!(cupomFiscal instanceof File) || cupomFiscal.size === 0) {
    return { error: "Anexe a foto do cupom fiscal." };
  }

  const notes = String(formData.get("notes") ?? "").trim() || null;

  let pedidoId: string;
  let pedidoNumber: number;
  try {
    const result = await createPedidoEncomenda({
      storeId,
      requestedByName,
      requesterRole: requester.kind,
      vendedorName,
      clienteCodigo,
      notes,
      items,
      fornecedorTipo,
      fabricaId,
      fornecedorExterno,
    });
    pedidoId = result.id;
    pedidoNumber = result.pedidoNumber;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Não foi possível criar o pedido." };
  }

  try {
    await saveEncomendaPhoto({ pedidoId, file: cupomFiscal, uploadedBy: requestedByName, caption: "Cupom fiscal" });
  } catch (err) {
    // Pedido já foi criado — não bloqueia o fluxo por causa da foto, só avisa.
    return {
      error: `Pedido #${pedidoNumber} criado, mas a foto não pôde ser salva: ${err instanceof Error ? err.message : "erro desconhecido"}`,
    };
  }

  await notifyTelegramNewEncomenda({ pedidoNumber, storeName: store.name });

  revalidatePath("/assistencia/encomendas/caixa");
  revalidatePath("/assistencia/encomendas/fila");
  redirect(`/assistencia/encomendas/solicitar?enviado=1&pedido=${pedidoNumber}`);
}

// Solicitante corrige o próprio pedido (produto errado, esqueceu o código
// do cliente etc.) em vez de lançar um novo do zero -- era exatamente essa
// falta que gerava pedido duplicado. Só produtos/vendedor/código do
// cliente/observações são editáveis aqui -- loja e fornecedor definem pra
// onde o pedido roteia, e mudar isso depois é confuso; nesse caso o certo é
// negar/cancelar e lançar de novo. canEditPedido (encomendaRequester.ts) já
// garante que só quem pode ver esse pedido como solicitante mexe nele, e só
// enquanto ainda está "solicitado".
export async function editPedidoEncomendaAction(pedidoId: string, _state: FormState, formData: FormData): Promise<FormState> {
  const requester = await resolveEncomendaRequester();
  if (!requester) return { error: "Sessão expirada. Faça login de novo." };

  const admin = getSupabaseAdmin();
  const { data: current, error: fetchError } = await admin
    .from("pedidos_encomenda")
    .select("status, store_id, requested_by_name")
    .eq("id", pedidoId)
    .single();
  if (fetchError || !current) return { error: "Pedido não encontrado." };

  if (!canEditPedido(requester, { status: current.status, storeId: current.store_id, requestedByName: current.requested_by_name })) {
    return { error: "Esse pedido não pode mais ser editado — ou já saiu de \"solicitado\", ou não é seu." };
  }

  const vendedorName = String(formData.get("vendedor_name") ?? "").trim() || null;
  const clienteCodigo = String(formData.get("cliente_codigo") ?? "").trim() || null;
  if (!clienteCodigo) return { error: "Informe o código do cliente." };
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const produtoDescricoes = formData.getAll("item_produto_descricao").map((v) => String(v).trim());
  const produtoCodigos = formData.getAll("item_produto_codigo").map((v) => String(v).trim() || null);
  const quantidades = formData.getAll("item_quantidade").map((v) => {
    const n = parseInt(String(v), 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
  });
  const items: NewPedidoEncomendaItem[] = produtoDescricoes
    .map((produtoDescricao, i) => ({ produtoDescricao, produtoCodigo: produtoCodigos[i] ?? null, quantidade: quantidades[i] ?? 1 }))
    .filter((item) => item.produtoDescricao.length > 0);
  if (items.length === 0) return { error: "Adicione pelo menos um produto." };

  try {
    await updatePedidoEncomendaContent(pedidoId, { vendedorName, clienteCodigo, notes, items }, { name: requester.name, role: requester.kind });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Não foi possível salvar as alterações." };
  }

  revalidatePath("/assistencia/encomendas/caixa");
  revalidatePath("/assistencia/encomendas/sac");
  revalidatePath("/assistencia/encomendas/fila");
  revalidatePath(`/assistencia/encomendas/fila/${pedidoId}`);
  redirect(`/assistencia/encomendas/${pedidoId}/editar?salvo=1`);
}

// Solicitante desiste do próprio pedido -- mesma janela e mesma checagem de
// canEditPedido usadas pra editar: só enquanto ninguém do outro lado
// (fábrica/CD) mexeu ainda. Depois disso quem cancela é admin/assistência
// (cancelPedido), por já estar em produção/expedição.
export async function cancelPedidoAsRequester(pedidoId: string, note: string): Promise<void> {
  const requester = await resolveEncomendaRequester();
  if (!requester) throw new Error("Sessão expirada. Faça login de novo.");
  if (!note.trim()) throw new Error("Informe o motivo do cancelamento.");

  const admin = getSupabaseAdmin();
  const { data: current, error: fetchError } = await admin
    .from("pedidos_encomenda")
    .select("status, store_id, requested_by_name")
    .eq("id", pedidoId)
    .single();
  if (fetchError || !current) throw new Error("Pedido não encontrado.");

  if (!canEditPedido(requester, { status: current.status, storeId: current.store_id, requestedByName: current.requested_by_name })) {
    throw new Error('Esse pedido não pode mais ser cancelado por aqui — ou já saiu de "solicitado", ou não é seu.');
  }

  await updatePedidoStatus(pedidoId, { name: requester.name, role: requester.kind }, current.status, "cancelado", { note: note.trim() });

  revalidatePath("/assistencia/encomendas/caixa");
  revalidatePath("/assistencia/encomendas/sac");
  revalidatePath("/assistencia/encomendas/fila");
  revalidatePath(`/assistencia/encomendas/fila/${pedidoId}`);
}

// Avanço de status pela fila interna (fábrica/CD/admin/assistência) — mesmo
// padrão de updatePartOrderStatus (src/app/assistencia/pecas-actions.ts), mas
// com a transição validada por papel em requireEncomendaAction (dal.ts): cada
// papel só avança o trecho do fluxo que é dele. requireEncomendaActor()
// resolve sessão PIN de CD/fábrica ou perfil Supabase Auth de admin/assistência.
export async function advancePedidoStatus(
  pedidoId: string,
  toStatus: string,
  opts: { carga?: string; nfE?: string } = {}
): Promise<void> {
  const actor = await requireEncomendaActor();
  if (!isPedidoEncomendaStatus(toStatus)) throw new Error("Status inválido.");
  // Cancelamento e negação sempre passam por cancelPedido/denyPedido (nota
  // obrigatória) — não por aqui, senão dava pra pular o motivo.
  if (toStatus === "cancelado") throw new Error("Use a ação de cancelamento.");
  if (toStatus === "negado") throw new Error("Use a ação de negar pedido.");

  const admin = getSupabaseAdmin();
  const { data: current, error: fetchError } = await admin
    .from("pedidos_encomenda")
    .select("status, prazo_fabrica_cd, prazo_cd_loja, fornecedor_tipo, fabrica_id")
    .eq("id", pedidoId)
    .single();
  if (fetchError || !current) throw new Error("Pedido não encontrado.");

  requireEncomendaAction(actor, { status: current.status, fornecedorTipo: current.fornecedor_tipo, fabricaId: current.fabrica_id }, toStatus);

  // Prazo prometido de cada etapa -- obrigatório no momento em que quem é
  // dono da etapa aceita o pedido (fábrica: solicitado -> em_producao; CD:
  // pronto_para_expedicao -> em_carga; ou, se o fornecedor é externo, o
  // próprio CD assume as duas etapas e essa checagem vale já no
  // solicitado -> pronto_para_expedicao, que é o "aceitar" equivalente
  // nesse fluxo). É definido separadamente via PedidoPrazoField
  // (setPedidoPrazoFabricaCdAction/CdLoja), não nesse clique -- aqui só
  // confere que já foi salvo antes de deixar avançar.
  const externo = current.fornecedor_tipo === "fabrica_externa";
  const aceitandoPedido = externo ? toStatus === "pronto_para_expedicao" && current.status === "solicitado" : toStatus === "em_producao";
  if (aceitandoPedido && !current.prazo_fabrica_cd) {
    throw new Error('Defina o "Prazo fábrica → CD" antes de avançar.');
  }
  if (toStatus === "em_carga" && !current.prazo_cd_loja) {
    throw new Error('Defina o "Prazo CD → loja" antes de avançar.');
  }
  if (toStatus === "faturado" && !opts.nfE?.trim()) {
    throw new Error("Informe o número da NF-e.");
  }

  await updatePedidoStatus(pedidoId, actor, current.status, toStatus, {
    carga: opts.carga?.trim(),
    nfE: opts.nfE?.trim(),
  });

  revalidatePath("/assistencia/encomendas/fila");
  revalidatePath(`/assistencia/encomendas/fila/${pedidoId}`);
  revalidatePath("/assistencia/encomendas/caixa");
}

// Ação em lote da fábrica (ou admin/assistência) pra marcar vários pedidos
// "em produção" como "enviado para o CD" de uma vez, evitando abrir um por um
// -- mesma regra de transição de advancePedidoStatus (requireEncomendaAction),
// só que validada pra todos os ids ANTES de gravar qualquer um (tudo ou nada,
// sem aplicar parcial se algum pedido não puder avançar).
export async function bulkMarkEnviadoParaCD(pedidoIds: string[]): Promise<void> {
  const actor = await requireEncomendaActor();
  if (pedidoIds.length === 0) throw new Error("Selecione ao menos um pedido.");

  const admin = getSupabaseAdmin();
  const { data: rows, error: fetchError } = await admin
    .from("pedidos_encomenda")
    .select("id, status, fornecedor_tipo, fabrica_id")
    .in("id", pedidoIds);
  if (fetchError || !rows || rows.length !== pedidoIds.length) {
    throw new Error("Um ou mais pedidos não foram encontrados.");
  }

  for (const row of rows) {
    requireEncomendaAction(actor, { status: row.status, fornecedorTipo: row.fornecedor_tipo, fabricaId: row.fabrica_id }, "pronto_para_expedicao");
  }
  for (const row of rows) {
    await updatePedidoStatus(row.id, actor, row.status, "pronto_para_expedicao");
  }

  revalidatePath("/assistencia/encomendas/fila");
}

// Cancelamento fica restrito a admin/assistência e sempre exige um motivo,
// já que reverte o trabalho de loja/fábrica/CD.
export async function cancelPedido(pedidoId: string, note: string): Promise<void> {
  const actor = await requireEncomendaActor();
  if (actor.role !== "admin" && actor.role !== "assistencia") {
    throw new Error(`Ação não permitida para o papel "${actor.role}".`);
  }
  if (!note.trim()) throw new Error("Informe o motivo do cancelamento.");

  const admin = getSupabaseAdmin();
  const { data: current, error: fetchError } = await admin
    .from("pedidos_encomenda")
    .select("status")
    .eq("id", pedidoId)
    .single();
  if (fetchError || !current) throw new Error("Pedido não encontrado.");

  await updatePedidoStatus(pedidoId, actor, current.status, "cancelado", { note: note.trim() });

  revalidatePath("/assistencia/encomendas/fila");
  revalidatePath(`/assistencia/encomendas/fila/${pedidoId}`);
  revalidatePath("/assistencia/encomendas/caixa");
}

// Negação fica restrita a quem cuida do pedido nessa etapa -- fábrica (só da
// fábrica que é dela) ou CD (qualquer pedido, interno ou externo -- CD tem
// visão de tudo), ou admin/assistência por supervisão -- e só vale enquanto o
// pedido ainda está "solicitado": depois que entra em produção/expedição,
// qualquer desistência já passa por cancelPedido. Motivo sempre obrigatório,
// igual ao cancelamento.
export async function denyPedido(pedidoId: string, reason: string): Promise<void> {
  const actor = await requireEncomendaActor();
  if (!reason.trim()) throw new Error("Informe o motivo da recusa.");

  const admin = getSupabaseAdmin();
  const { data: current, error: fetchError } = await admin
    .from("pedidos_encomenda")
    .select("status, fornecedor_tipo, fabrica_id")
    .eq("id", pedidoId)
    .single();
  if (fetchError || !current) throw new Error("Pedido não encontrado.");
  if (current.status !== "solicitado") throw new Error("Só é possível negar um pedido que ainda está solicitado.");

  requireEncomendaAction(actor, { status: current.status, fornecedorTipo: current.fornecedor_tipo, fabricaId: current.fabrica_id }, "negado");

  await updatePedidoStatus(pedidoId, actor, current.status, "negado", { note: reason.trim() });

  revalidatePath("/assistencia/encomendas/fila");
  revalidatePath(`/assistencia/encomendas/fila/${pedidoId}`);
  revalidatePath("/assistencia/encomendas/caixa");
}

// Correção de fábrica/fornecedor errado (ex.: pedido lançado pra Beds/Aiam
// Estofados quando devia ser Colchões) sem precisar negar o pedido e a loja
// relançar do zero reanexando cupom fiscal etc. Restrito a quem tem visão do
// fluxo inteiro (CD vê a fila toda; admin/assistência por supervisão) --
// nunca a fábrica/loja, que são justamente quem erra o destino. Só vale
// enquanto "solicitado" (updatePedidoFornecedor garante isso de novo, com
// trava de corrida).
export async function updatePedidoFornecedorAction(
  pedidoId: string,
  input: { fornecedorTipo: "fabrica_interna" | "fabrica_externa"; fabricaId: string | null; fornecedorExterno: string | null }
): Promise<void> {
  const actor = await requireEncomendaActor();
  if (actor.role !== "admin" && actor.role !== "assistencia" && actor.role !== "cd") {
    throw new Error(`Ação não permitida para o papel "${actor.role}".`);
  }

  let fornecedorTipo: "fabrica_interna" | "fabrica_externa";
  let fabricaId: string | null = null;
  let fornecedorExterno: string | null = null;
  if (input.fornecedorTipo === "fabrica_externa") {
    if (!EXTERNAL_FABRICAS.includes(input.fornecedorExterno ?? "")) throw new Error("Selecione um fornecedor externo válido.");
    fornecedorTipo = "fabrica_externa";
    fornecedorExterno = input.fornecedorExterno;
  } else {
    if (!INTERNAL_FABRICAS.some((f) => f.id === input.fabricaId)) throw new Error("Selecione a fábrica do pedido.");
    fornecedorTipo = "fabrica_interna";
    fabricaId = input.fabricaId;
  }

  await updatePedidoFornecedor(pedidoId, actor, { fornecedorTipo, fabricaId, fornecedorExterno });

  revalidatePath("/assistencia/encomendas/fila");
  revalidatePath(`/assistencia/encomendas/fila/${pedidoId}`);
  revalidatePath("/assistencia/encomendas/caixa");
}

// Desfaz a última mudança de status por engano -- quem pode chamar (mesmo
// papel de quem fez a mudança, ou admin/assistência) e a janela de tempo já
// são validados em undoLastPedidoStatusChange (pedidosEncomenda.ts); aqui só
// resolve o actor e revalida as telas.
export async function undoLastPedidoStatusChangeAction(pedidoId: string): Promise<void> {
  const actor = await requireEncomendaActor();
  await undoLastPedidoStatusChange(pedidoId, actor);

  revalidatePath("/assistencia/encomendas/fila");
  revalidatePath(`/assistencia/encomendas/fila/${pedidoId}`);
  revalidatePath("/assistencia/encomendas/caixa");
}

export async function addPedidoNoteAction(pedidoId: string, note: string): Promise<void> {
  const actor = await requireEncomendaActor();
  await addPedidoNote(pedidoId, actor, note);
  revalidatePath(`/assistencia/encomendas/fila/${pedidoId}`);
}

// Prazo fábrica -> CD: obrigatório em advancePedidoStatus na primeira vez
// (transição solicitado -> em_producao), mas continua editável depois disso
// -- só quem é dono dessa etapa (fábrica, ou o CD quando o fornecedor é
// externo -- não existe fábrica pra definir nesse caso, ver dal.ts) ou
// admin/assistência.
export async function setPedidoPrazoFabricaCdAction(pedidoId: string, value: string): Promise<void> {
  const actor = await requireEncomendaActor();
  if (!value.trim()) throw new Error("Informe uma data.");

  if (actor.role !== "admin" && actor.role !== "assistencia") {
    const admin = getSupabaseAdmin();
    const { data: pedido } = await admin.from("pedidos_encomenda").select("fornecedor_tipo, fabrica_id").eq("id", pedidoId).maybeSingle();
    const externo = pedido?.fornecedor_tipo === "fabrica_externa";
    // Mesma regra de fabricaId de requireEncomendaAction (dal.ts) -- sem
    // isso, operador da Fábrica A definia prazo em pedido da Fábrica B só
    // sabendo o id.
    const matchesFabrica = !actor.fabricaId || !pedido?.fabrica_id || actor.fabricaId === pedido.fabrica_id;
    const podeDefinir = (actor.role === "fabrica" && !externo && matchesFabrica) || (actor.role === "cd" && externo);
    if (!podeDefinir) {
      throw new Error(externo ? "Só o CD pode definir esse prazo (fornecedor externo)." : "Só a fábrica desse pedido pode definir esse prazo.");
    }
  }
  await setPedidoPrazoEtapa(pedidoId, actor, "prazo_fabrica_cd", value.trim());
  revalidatePath(`/assistencia/encomendas/fila/${pedidoId}`);
  revalidatePath("/assistencia/encomendas/fila");
  revalidatePath("/assistencia/encomendas/caixa");
}

// Prazo CD -> loja: mesma ideia, obrigatório na transição
// pronto_para_expedicao -> em_carga, editável depois só por quem é dono
// dessa etapa (CD) ou admin/assistência.
export async function setPedidoPrazoCdLojaAction(pedidoId: string, value: string): Promise<void> {
  const actor = await requireEncomendaActor();
  if (actor.role !== "cd" && actor.role !== "admin" && actor.role !== "assistencia") {
    throw new Error("Só o CD pode definir esse prazo.");
  }
  if (!value.trim()) throw new Error("Informe uma data.");
  await setPedidoPrazoEtapa(pedidoId, actor, "prazo_cd_loja", value.trim());
  revalidatePath(`/assistencia/encomendas/fila/${pedidoId}`);
  revalidatePath("/assistencia/encomendas/fila");
  revalidatePath("/assistencia/encomendas/caixa");
}
