"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getProfile, requireRole, requireManageAccess } from "@/lib/dal";
import {
  SHIFT_LABELS,
  SAC_CATEGORIES,
  SAC_CATEGORY_LABELS,
  SAC_MANAGED_TYPES,
  MANOEL_ONLY_TYPES,
  MANOEL_ONLY_ASSEMBLER,
  REQUEST_TYPE_LABELS,
  STATUS_LABELS,
} from "@/lib/assistenciaLabels";
import { notifyLoja } from "@/lib/notifications";
import { resolveDriverName } from "@/lib/payments";
import {
  saveRequestPhoto,
  getPhotoForAuth,
  deleteRequestPhoto,
  uploadPendingRequestPhoto,
  attachPendingRequestPhoto,
  discardPendingRequestPhoto,
} from "@/lib/servicePhotos";
import { randomUUID } from "crypto";
import { getLojaGerenteSession } from "@/app/assistencia/loja-actions";
import { getGerenteStoreIds } from "@/lib/gerentes";
import { getClientIp, checkAndRecordPublicSubmission } from "@/lib/rateLimit";
import { checkIpRateLimit, recordFailedIpAttempt } from "@/lib/ipRateLimit";
import { isRota, getRotaWeekdayConfig, getRotaForDate, ROTA_LABELS } from "@/lib/rotas";
import { findTotvsClientByCode, findTotvsProductByCode, type TotvsClientMatch, type TotvsProductMatch } from "@/lib/totvsLookup";
import {
  ASSISTENCIA_TEAM_COOKIE_NAME,
  ASSISTENCIA_TEAM_PENDING_MAX_AGE,
  signAssistenciaTeamPending,
  verifyAssistenciaTeamPending,
} from "@/lib/assistenciaTeamAuth";
import { verifyPin } from "@/lib/pinAuth";
import { checkPinLockout, recordFailedPinAttempt, resetPinAttempts } from "@/lib/pinLockout";
import { isValidLoginPinFormat } from "@/lib/pinConfig";
import { ADDRESS_NUMBER_REQUIRED_TYPES } from "@/lib/serviceRequests";

const REQUEST_TYPES = [
  "montagem",
  "desmontagem",
  "recolhimento",
  "troca_peca",
  "vistoria",
  "notificacao_externa",
  "troca_produto",
] as const;
const STATUSES = ["aberta", "em_contato", "em_andamento", "remarcar", "concluida", "cancelada"] as const;
const SHIFTS = ["manha", "tarde", "dia", "urgencia"] as const;

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const str = String(value ?? "").trim();
  return str.length > 0 ? str : null;
}

// Número é obrigatório em montagem/desmontagem (ver ADDRESS_NUMBER_REQUIRED_TYPES);
// apto/bloco só é obrigatório quando a pessoa marcou "é apartamento" — usado
// nas 3 telas de criação (loja, SAC, assistência/admin) e nas 2 de edição.
function readAddressNumberFields(
  formData: FormData,
  type: string
): { number: string; isApartment: boolean; complement: string; error?: string } {
  const number = String(formData.get("client_address_number") ?? "").trim();
  const isApartment = formData.get("client_is_apartment") === "on";
  const complement = String(formData.get("client_address_complement") ?? "").trim();
  if ((ADDRESS_NUMBER_REQUIRED_TYPES as string[]).includes(type)) {
    if (!number) return { number, isApartment, complement, error: "Informe o número do endereço." };
    if (isApartment && !complement) return { number, isApartment, complement, error: "Informe o número do apartamento." };
  }
  return { number, isApartment, complement };
}

export type FormState = { error?: string } | undefined;

export async function signIn(_state: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { error: "Informe e-mail e senha." };
  }

  const ip = await getClientIp();
  const ipLimit = await checkIpRateLimit(ip);
  if (ipLimit.locked) {
    return { error: `Muitas tentativas deste local. Tente de novo em ${ipLimit.minutesLeft} minuto(s).` };
  }

  // Login único por time (várias pessoas da assistência usam a mesma
  // credencial): em vez de autenticar direto, manda pra tela "Quem é você?"
  // escolher o nome — só ali a sessão real do Supabase Auth da pessoa
  // escolhida é criada (ver chooseAssistenciaIdentity/establishAssistenciaIdentitySession),
  // então todo o resto do sistema (histórico, "assumir chamado" etc.) funciona
  // exatamente como se ela tivesse logado com a própria conta. SAC saiu desse
  // fluxo -- agora loga direto por nome+PIN em /assistencia/sac/login (ver
  // sacPinSignIn), sem credencial compartilhada nenhuma.
  const teamCredentials: { team: "assistencia"; email?: string; password?: string }[] = [
    { team: "assistencia", email: process.env.ASSISTENCIA_TEAM_LOGIN_EMAIL, password: process.env.ASSISTENCIA_TEAM_LOGIN_PASSWORD },
  ];
  const matchedTeam = teamCredentials.find((c) => c.email && c.password && email === c.email && password === c.password);
  if (matchedTeam) {
    const cookieStore = await cookies();
    cookieStore.set(ASSISTENCIA_TEAM_COOKIE_NAME, signAssistenciaTeamPending(matchedTeam.team), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: ASSISTENCIA_TEAM_PENDING_MAX_AGE,
      path: "/assistencia",
    });
    redirect("/assistencia/quem-e-voce");
  }

  const supabase = await getSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    await recordFailedIpAttempt(ip);
    return { error: "E-mail ou senha inválidos." };
  }

  redirect("/assistencia/inicio");
}

export async function signOut() {
  const supabase = await getSupabaseServer();
  await supabase.auth.signOut();
  redirect("/assistencia/login");
}

// Troca um profileId por uma sessão de verdade do Supabase Auth da conta
// dela, usando um magic link gerado no servidor (nunca enviado por e-mail,
// só resgatado aqui mesmo) — assim a sessão resultante é indistinguível de
// um login normal com e-mail/senha próprios. Reaproveitada tanto pelo login
// compartilhado da equipe (chooseAssistenciaIdentity, abaixo) quanto pelo
// login por PIN do SAC (sacPinSignIn) -- os dois só diferem em COMO chegam
// no profileId certo, essa troca de sessão é idêntica pros dois.
async function establishAssistenciaIdentitySession(profileId: string): Promise<boolean> {
  const admin = getSupabaseAdmin();
  const { data: userData, error: userError } = await admin.auth.admin.getUserById(profileId);
  if (userError || !userData.user?.email) return false;

  try {
    const supabase = await getSupabaseServer();

    // Encerra qualquer sessão já existente nesse navegador (ex.: alguém
    // trocando de identidade sem clicar em "Sair" antes) — sem isso o SDK às
    // vezes tenta renovar um refresh token de uma sessão anterior que já não
    // é mais válido e lança um erro não tratado em vez de simplesmente trocar.
    await supabase.auth.signOut();

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: userData.user.email,
    });
    if (linkError || !linkData) return false;

    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: "magiclink",
    });
    if (verifyError) return false;
  } catch (err) {
    console.error("Falha ao estabelecer sessão de identidade:", err);
    return false;
  }

  return true;
}

// Segunda etapa do login compartilhado da equipe (ver signIn acima): troca a
// identidade escolhida por uma sessão de verdade via establishAssistenciaIdentitySession.
export async function chooseAssistenciaIdentity(profileId: string) {
  const cookieStore = await cookies();
  const pending = cookieStore.get(ASSISTENCIA_TEAM_COOKIE_NAME)?.value;
  const team = verifyAssistenciaTeamPending(pending);
  if (!team) {
    redirect("/assistencia/login");
  }

  const admin = getSupabaseAdmin();
  const { data: profile } = await admin.from("profiles").select("id, role").eq("id", profileId).maybeSingle();
  // Reconfirma o papel contra o time que efetivamente logou na credencial
  // compartilhada — nunca confia só na lista mostrada na tela (ver
  // "quem-e-voce/page.tsx"), senão bastaria manipular o profileId enviado
  // pelo form pra uma pessoa do outro time virar aquela identidade.
  if (!profile || profile.role !== team) {
    redirect("/assistencia/quem-e-voce?erro=1");
  }

  const ok = await establishAssistenciaIdentitySession(profileId);
  if (!ok) {
    redirect("/assistencia/quem-e-voce?erro=1");
  }

  cookieStore.delete({ name: ASSISTENCIA_TEAM_COOKIE_NAME, path: "/assistencia" });
  redirect("/assistencia/inicio");
}

export type SacFormState = { error?: string } | undefined;

// Login do SAC: nome + PIN, verificado direto contra profiles (role='sac') --
// sem credencial de time compartilhada nem tela de escolher nome (ver
// contexto em supabase/migrations/0053_sac_profile_pin.sql). Erro genérico
// tanto pra nome não encontrado quanto PIN errado, mesmo padrão
// anti-enumeração já usado nos outros logins por PIN (fabrica-actions.ts,
// cd-actions.ts).
export async function sacPinSignIn(_state: SacFormState, formData: FormData): Promise<SacFormState> {
  const typedName = String(formData.get("name") ?? "").trim();
  const pin = String(formData.get("pin") ?? "").trim();

  if (!typedName) return { error: "Informe seu nome." };
  if (!isValidLoginPinFormat(pin)) return { error: "Digite os números do seu PIN." };

  const ip = await getClientIp();
  const ipLimit = await checkIpRateLimit(ip);
  if (ipLimit.locked) {
    return { error: `Muitas tentativas deste local. Tente de novo em ${ipLimit.minutesLeft} minuto(s).` };
  }

  const admin = getSupabaseAdmin();
  const { data: sacProfiles } = await admin.from("profiles").select("id, full_name, pin_hash").eq("role", "sac");
  const match = (sacProfiles ?? []).find((p) => p.full_name.toLowerCase() === typedName.toLowerCase());

  if (!match) {
    await recordFailedIpAttempt(ip);
    return { error: "Nome ou PIN incorretos." };
  }

  const lockout = await checkPinLockout("profiles", "id", match.id);
  if (lockout.locked) {
    return { error: `Muitas tentativas erradas. Tente de novo em ${lockout.minutesLeft} minuto(s).` };
  }

  if (!match.pin_hash || !verifyPin(pin, match.pin_hash)) {
    await recordFailedPinAttempt("profiles", "id", match.id);
    await recordFailedIpAttempt(ip);
    return { error: "Nome ou PIN incorretos." };
  }
  await resetPinAttempts("profiles", "id", match.id);

  const ok = await establishAssistenciaIdentitySession(match.id);
  if (!ok) return { error: "Não foi possível entrar. Tente de novo." };

  redirect("/assistencia/inicio");
}

// Autopreenche nome/CPF/telefone/endereço a partir do código do cliente
// (PublicRequestForm.tsx) -- só sugestão, não trava o envio se não achar ou
// se a pessoa preferir digitar diferente do que veio do Protheus.
export async function lookupTotvsClient(code: string): Promise<TotvsClientMatch | null> {
  const gerenteName = await getLojaGerenteSession();
  if (!gerenteName) return null;
  return findTotvsClientByCode(code);
}

// Mesma ideia de lookupTotvsClient, mas pro código do produto (PublicRequestForm.tsx,
// seção "Produtos") -- busca no histórico de vendas do TOTVS (não existe
// catálogo de produtos separado).
export async function lookupTotvsProduct(code: string): Promise<TotvsProductMatch | null> {
  const gerenteName = await getLojaGerenteSession();
  if (!gerenteName) return null;
  return findTotvsProductByCode(code);
}

// Versões de lookupTotvsClient/lookupTotvsProduct pra quem usa sessão da
// equipe interna (Supabase Auth: assistência/admin/sac) em vez de sessão de
// gerente de loja -- usadas em SacCreateRequestForm.tsx e QuickCreateRequestForm.tsx.
export async function lookupTotvsClientForTeam(code: string): Promise<TotvsClientMatch | null> {
  await getProfile();
  return findTotvsClientByCode(code);
}

export async function lookupTotvsProductForTeam(code: string): Promise<TotvsProductMatch | null> {
  await getProfile();
  return findTotvsProductByCode(code);
}

// Sem sessão do Supabase Auth (usa a sessão de gerente de loja por PIN — ver
// src/lib/gerentes.ts) — /assistencia/solicitar exige login de gerente antes
// de mostrar o formulário, então chegar aqui sem sessão válida é só alguém
// chamando a action direto. Rate limit por IP fica como defesa extra contra
// um PIN vazado sendo usado pra spam (src/lib/rateLimit.ts).
export async function createPublicRequest(_state: FormState, formData: FormData): Promise<FormState> {
  const ip = await getClientIp();
  const { allowed } = await checkAndRecordPublicSubmission(ip);
  if (!allowed) {
    return { error: "Muitas solicitações enviadas em pouco tempo. Aguarde alguns minutos e tente de novo." };
  }

  const gerenteName = await getLojaGerenteSession();
  if (!gerenteName) return { error: "Sessão expirada. Faça login de novo." };

  // A solicitação só pode ser para uma das lojas do gerente. Se ele cuida de
  // uma loja só, não há ambiguidade e a gente força o valor (ignora o que
  // veio do form, mesmo que alguém tente adulterar o <select> pelo devtools).
  // Se cuida de várias, valida que o valor escolhido está entre as dele.
  let storeId = String(formData.get("store_id") ?? "").trim();
  const gerenteStoreIds = await getGerenteStoreIds(gerenteName);
  if (gerenteStoreIds.length === 1) {
    storeId = gerenteStoreIds[0];
  } else if (!gerenteStoreIds.includes(storeId)) {
    return { error: "Selecione uma das lojas que você gerencia." };
  }

  // Nome do solicitante vem da sessão do gerente, não do form (o campo no
  // formulário é só leitura) — evita adulteração via devtools, igual ao store_id acima.
  const requestedByName = gerenteName;
  const requestedDeadline = String(formData.get("requested_deadline") ?? "").trim();

  if (!storeId) return { error: "Selecione a loja." };
  if (!requestedDeadline) return { error: "Informe o prazo desejado." };

  const type = String(formData.get("type") ?? "");
  if (!REQUEST_TYPES.includes(type as (typeof REQUEST_TYPES)[number])) {
    return { error: "Tipo de solicitação inválido." };
  }

  // Montagem/desmontagem pode ser pra um cliente (o normal) ou pra móvel de
  // mostruário da própria loja -- nesse segundo caso não existe venda,
  // cliente, CPF nem endereço pra pedir (ver showClientFields em
  // PublicRequestForm.tsx). Só vale pra esses dois tipos: os outros sempre
  // envolvem um cliente de verdade.
  const requestTarget = String(formData.get("request_target") ?? "cliente");
  const isStoreTarget = requestTarget === "loja" && (type === "montagem" || type === "desmontagem");

  let clientName = "";
  let orderCode = "";
  let invoiceNumber = "";
  let sellerName = "";
  let clientCpf = "";
  let clientPhone = "";
  let clientAddress = "";
  let clientNeighborhood = "";
  let addressNumber = "";
  let addressIsApartment = false;
  let addressComplement = "";

  if (!isStoreTarget) {
    clientName = String(formData.get("client_name") ?? "").trim();
    if (!clientName) {
      return { error: "Informe o nome do cliente." };
    }

    orderCode = String(formData.get("order_code") ?? "").trim();
    if (!orderCode) return { error: "Informe o código do pedido/venda." };

    invoiceNumber = String(formData.get("invoice_number") ?? "").trim();
    if (!invoiceNumber) return { error: "Informe o número da nota fiscal." };

    sellerName = String(formData.get("seller_name") ?? "").trim();
    if (!sellerName) return { error: "Informe o vendedor(a)." };

    clientCpf = String(formData.get("client_cpf") ?? "").trim();
    if (!clientCpf) return { error: "Informe o CPF do cliente." };

    clientPhone = String(formData.get("client_phone") ?? "").trim();
    if (!clientPhone) return { error: "Informe o telefone de contato." };

    // Só os tipos que envolvem visita física exigem endereço -- os outros nem
    // mostram esse campo no formulário (ver showAddress em PublicRequestForm).
    const ADDRESS_REQUIRED_TYPES = ["montagem", "desmontagem", "recolhimento", "troca_peca", "vistoria"];
    if (ADDRESS_REQUIRED_TYPES.includes(type)) {
      clientAddress = String(formData.get("client_address") ?? "").trim();
      if (!clientAddress) return { error: "Informe o endereço." };
      clientNeighborhood = String(formData.get("client_neighborhood") ?? "").trim();
      if (!clientNeighborhood) return { error: "Informe o bairro." };

      const addressNumberFields = readAddressNumberFields(formData, type);
      if (addressNumberFields.error) return { error: addressNumberFields.error };
      addressNumber = addressNumberFields.number;
      addressIsApartment = addressNumberFields.isApartment;
      addressComplement = addressNumberFields.complement;
    }
  }

  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { error: "Informe o motivo." };

  // Só faz sentido pra montagem/desmontagem — pedir os dois numa visita só,
  // sem precisar abrir dois chamados separados pro mesmo cliente.
  const comboMontagemDesmontagem = (type === "montagem" || type === "desmontagem") && formData.get("combo_montagem_desmontagem") === "on";

  function parseItems(prefix: string): { product: string; quantity: number; partCode: string | null }[] {
    const products = formData.getAll(prefix + "_product").map((v) => String(v).trim());
    const quantities = formData.getAll(prefix + "_quantity").map((v) => {
      const n = parseInt(String(v), 10);
      return Number.isFinite(n) && n > 0 ? n : 1;
    });
    const codes = formData.getAll(prefix + "_code").map((v) => String(v).trim() || null);
    return products
      .map((product, i) => ({ product, quantity: quantities[i] ?? 1, partCode: codes[i] ?? null }))
      .filter((item) => item.product.length > 0);
  }

  // Sem combo, "item" é a lista única de sempre (a ação já é o type do
  // chamado). Com combo, "item" continua sendo os produtos do type principal
  // e "item_secondary" os da ação oposta -- ver PublicRequestForm.tsx.
  const primaryAction: "montar" | "desmontar" = type === "montagem" ? "montar" : "desmontar";
  const secondaryAction: "montar" | "desmontar" = primaryAction === "montar" ? "desmontar" : "montar";

  const primaryItems = parseItems("item").map((item) => ({
    ...item,
    action: comboMontagemDesmontagem ? primaryAction : null,
  }));
  const secondaryItems = comboMontagemDesmontagem
    ? parseItems("item_secondary").map((item) => ({ ...item, action: secondaryAction }))
    : [];
  const items = [...primaryItems, ...secondaryItems];

  if (type !== "notificacao_externa" && items.length === 0) {
    return { error: "Informe pelo menos um produto." };
  }
  if (comboMontagemDesmontagem && secondaryItems.length === 0) {
    return {
      error: `Informe pelo menos um produto pra ${secondaryAction === "montar" ? "montar" : "desmontar"} (a outra ação da visita combo).`,
    };
  }

  const admin = getSupabaseAdmin();

  const { data: store } = await admin.from("stores").select("id, name").eq("id", storeId).single();
  if (!store) return { error: "Loja inválida." };

  const { data, error } = await admin
    .from("service_requests")
    .insert({
      type,
      store_id: storeId,
      requested_by_name: requestedByName,
      requested_deadline: requestedDeadline,
      order_code: emptyToNull(orderCode),
      client_protheus_code: isStoreTarget ? null : emptyToNull(formData.get("client_protheus_code")),
      client_name: isStoreTarget ? `Mostruário — ${store.name}` : clientName,
      client_cpf: emptyToNull(clientCpf),
      client_phone: emptyToNull(clientPhone),
      client_address: emptyToNull(clientAddress),
      client_address_number: emptyToNull(addressNumber),
      client_is_apartment: addressIsApartment,
      client_address_complement: emptyToNull(addressComplement),
      client_neighborhood: emptyToNull(clientNeighborhood),
      reason: reason,
      restriction_note: emptyToNull(formData.get("restriction_note")),
      notes: emptyToNull(formData.get("notes")),
      seller_name: emptyToNull(sellerName),
      invoice_number: emptyToNull(invoiceNumber),
      sac_category: type === "notificacao_externa" ? emptyToNull(formData.get("sac_category")) : null,
      combo_montagem_desmontagem: comboMontagemDesmontagem,
    })
    .select("id, ticket_number")
    .single();

  if (error || !data) {
    return { error: `Não foi possível criar a solicitação: ${error?.message ?? "erro desconhecido"}` };
  }

  if (items.length > 0) {
    const { error: itemsError } = await admin
      .from("service_request_items")
      .insert(
        items.map((item) => ({
          request_id: data.id,
          product: item.product,
          part_code: item.partCode,
          quantity: item.quantity,
          item_action: item.action,
        }))
      );
    if (itemsError) {
      return { error: `Solicitação criada, mas falhou ao salvar os itens: ${itemsError.message}` };
    }
  }

  // Notificação SAC: gera um protocolo pro cliente e um prazo legal padrão
  // (30 dias, ajustável depois pela assistência).
  if (type === "notificacao_externa") {
    const protocolNumber = `SAC-${new Date().getFullYear()}-${data.id.slice(0, 8).toUpperCase()}`;
    const legalDeadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await admin
      .from("service_requests")
      .update({ protocol_number: protocolNumber, legal_deadline: legalDeadline })
      .eq("id", data.id);
  }

  await admin.from("service_request_events").insert({
    request_id: data.id,
    actor_id: null,
    event_type: "created",
    to_status: "aberta",
  });

  redirect(`/assistencia/solicitar?enviado=1&chamado=${data.ticket_number}`);
}

// Gerente corrige a própria solicitação (produto errado, telefone errado
// etc.) em vez de abrir outra do zero -- mesma lógica por trás da edição de
// pedido de encomenda (ver editPedidoEncomendaAction em encomendas-actions.ts).
// Só enquanto a solicitação ainda está "aberta": depois que a assistência
// entra em contato, a correção passa a ser assunto de quem está atendendo,
// não mais de quem abriu. Tipo e "pra quem é" (cliente x mostruário) não
// mudam aqui -- errar isso é caso de cancelar e abrir de novo, não editar.
export async function editServiceRequestByGerente(requestId: string, _state: FormState, formData: FormData): Promise<FormState> {
  const gerenteName = await getLojaGerenteSession();
  if (!gerenteName) return { error: "Sessão expirada. Faça login de novo." };

  const admin = getSupabaseAdmin();
  const { data: current, error: fetchError } = await admin
    .from("service_requests")
    .select("type, status, store_id, client_name, order_code")
    .eq("id", requestId)
    .single();
  if (fetchError || !current) return { error: "Solicitação não encontrada." };

  const gerenteStoreIds = await getGerenteStoreIds(gerenteName);
  if (!gerenteStoreIds.includes(current.store_id)) return { error: "Essa solicitação não é de uma loja sua." };
  if (current.status !== "aberta") {
    return { error: "Essa solicitação não pode mais ser editada — a assistência já começou a atender." };
  }

  const type = current.type as (typeof REQUEST_TYPES)[number];
  // Mesma detecção usada só pra decidir quais campos aparecem/validar --
  // não existe coluna própria pra isso (ver isStoreTarget em createPublicRequest).
  const isStoreTarget = !current.order_code && (current.client_name ?? "").startsWith("Mostruário — ");

  const requestedDeadline = String(formData.get("requested_deadline") ?? "").trim();
  if (!requestedDeadline) return { error: "Informe o prazo desejado." };

  const comboMontagemDesmontagem =
    (type === "montagem" || type === "desmontagem") && formData.get("combo_montagem_desmontagem") === "on";

  let clientName = current.client_name ?? "";
  let orderCode = "";
  let invoiceNumber = "";
  let sellerName = "";
  let clientCpf = "";
  let clientPhone = "";
  let clientAddress = "";
  let clientNeighborhood = "";
  let addressNumber = "";
  let addressIsApartment = false;
  let addressComplement = "";

  if (!isStoreTarget) {
    clientName = String(formData.get("client_name") ?? "").trim();
    if (!clientName) return { error: "Informe o nome do cliente." };

    orderCode = String(formData.get("order_code") ?? "").trim();
    if (!orderCode) return { error: "Informe o código do pedido/venda." };

    invoiceNumber = String(formData.get("invoice_number") ?? "").trim();
    if (!invoiceNumber) return { error: "Informe o número da nota fiscal." };

    sellerName = String(formData.get("seller_name") ?? "").trim();
    if (!sellerName) return { error: "Informe o vendedor(a)." };

    clientCpf = String(formData.get("client_cpf") ?? "").trim();
    if (!clientCpf) return { error: "Informe o CPF do cliente." };

    clientPhone = String(formData.get("client_phone") ?? "").trim();
    if (!clientPhone) return { error: "Informe o telefone de contato." };

    const ADDRESS_REQUIRED_TYPES = ["montagem", "desmontagem", "recolhimento", "troca_peca", "vistoria"];
    if (ADDRESS_REQUIRED_TYPES.includes(type)) {
      clientAddress = String(formData.get("client_address") ?? "").trim();
      if (!clientAddress) return { error: "Informe o endereço." };
      clientNeighborhood = String(formData.get("client_neighborhood") ?? "").trim();
      if (!clientNeighborhood) return { error: "Informe o bairro." };

      const addressNumberFields = readAddressNumberFields(formData, type);
      if (addressNumberFields.error) return { error: addressNumberFields.error };
      addressNumber = addressNumberFields.number;
      addressIsApartment = addressNumberFields.isApartment;
      addressComplement = addressNumberFields.complement;
    }
  }

  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { error: "Informe o motivo." };

  function parseItems(prefix: string): { product: string; quantity: number; partCode: string | null }[] {
    const products = formData.getAll(prefix + "_product").map((v) => String(v).trim());
    const quantities = formData.getAll(prefix + "_quantity").map((v) => {
      const n = parseInt(String(v), 10);
      return Number.isFinite(n) && n > 0 ? n : 1;
    });
    const codes = formData.getAll(prefix + "_code").map((v) => String(v).trim() || null);
    return products
      .map((product, i) => ({ product, quantity: quantities[i] ?? 1, partCode: codes[i] ?? null }))
      .filter((item) => item.product.length > 0);
  }

  const primaryAction: "montar" | "desmontar" = type === "montagem" ? "montar" : "desmontar";
  const secondaryAction: "montar" | "desmontar" = primaryAction === "montar" ? "desmontar" : "montar";

  const primaryItems = parseItems("item").map((item) => ({
    ...item,
    action: comboMontagemDesmontagem ? primaryAction : null,
  }));
  const secondaryItems = comboMontagemDesmontagem
    ? parseItems("item_secondary").map((item) => ({ ...item, action: secondaryAction }))
    : [];
  const items = [...primaryItems, ...secondaryItems];

  if (type !== "notificacao_externa" && items.length === 0) {
    return { error: "Informe pelo menos um produto." };
  }
  if (comboMontagemDesmontagem && secondaryItems.length === 0) {
    return {
      error: `Informe pelo menos um produto pra ${secondaryAction === "montar" ? "montar" : "desmontar"} (a outra ação da visita combo).`,
    };
  }

  const { error: updateError } = await admin
    .from("service_requests")
    .update({
      requested_deadline: requestedDeadline,
      order_code: emptyToNull(orderCode),
      client_name: clientName,
      client_cpf: emptyToNull(clientCpf),
      client_phone: emptyToNull(clientPhone),
      client_address: emptyToNull(clientAddress),
      client_address_number: emptyToNull(addressNumber),
      client_is_apartment: addressIsApartment,
      client_address_complement: emptyToNull(addressComplement),
      client_neighborhood: emptyToNull(clientNeighborhood),
      reason,
      restriction_note: emptyToNull(formData.get("restriction_note")),
      notes: emptyToNull(formData.get("notes")),
      seller_name: emptyToNull(sellerName),
      invoice_number: emptyToNull(invoiceNumber),
      combo_montagem_desmontagem: comboMontagemDesmontagem,
    })
    .eq("id", requestId);
  if (updateError) return { error: `Não foi possível salvar: ${updateError.message}` };

  const { error: deleteItemsError } = await admin.from("service_request_items").delete().eq("request_id", requestId);
  if (deleteItemsError) return { error: `Itens não foram salvos: ${deleteItemsError.message}` };

  if (items.length > 0) {
    const { error: itemsError } = await admin.from("service_request_items").insert(
      items.map((item) => ({
        request_id: requestId,
        product: item.product,
        part_code: item.partCode,
        quantity: item.quantity,
        item_action: item.action,
      }))
    );
    if (itemsError) return { error: `Itens não foram salvos: ${itemsError.message}` };
  }

  await admin.from("service_request_events").insert({
    request_id: requestId,
    actor_id: null,
    event_type: "edited",
  });

  revalidatePath("/assistencia/loja");
  revalidatePath(`/assistencia/loja/${requestId}/editar`);
  redirect(`/assistencia/loja/${requestId}/editar?salvo=1`);
}

// Gerente desiste do próprio chamado -- mesma janela/checagem de
// editServiceRequestByGerente: só enquanto ainda está "aberta", antes da
// assistência entrar em contato. Depois disso quem cancela é a equipe
// interna (updateStatus), por já estar em atendimento.
export async function cancelServiceRequestByGerente(requestId: string, note: string): Promise<void> {
  const gerenteName = await getLojaGerenteSession();
  if (!gerenteName) throw new Error("Sessão expirada. Faça login de novo.");
  if (!note.trim()) throw new Error("Informe o motivo do cancelamento.");

  const admin = getSupabaseAdmin();
  const { data: current, error: fetchError } = await admin
    .from("service_requests")
    .select("status, store_id")
    .eq("id", requestId)
    .single();
  if (fetchError || !current) throw new Error("Solicitação não encontrada.");

  const gerenteStoreIds = await getGerenteStoreIds(gerenteName);
  if (!gerenteStoreIds.includes(current.store_id)) throw new Error("Essa solicitação não é de uma loja sua.");
  if (current.status !== "aberta") {
    throw new Error("Essa solicitação não pode mais ser cancelada por aqui — a assistência já começou a atender.");
  }

  const { data: updated, error } = await admin
    .from("service_requests")
    .update({ status: "cancelada", completed_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("status", "aberta")
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!updated) throw new Error("Essa solicitação já foi atualizada por outra pessoa. Recarregue a página e tente de novo.");

  await admin.from("service_request_events").insert({
    request_id: requestId,
    actor_id: null,
    event_type: "status_changed",
    from_status: "aberta",
    to_status: "cancelada",
    note: note.trim(),
  });

  await notifyLoja(current.store_id, {
    type: "status_changed",
    title: "Solicitação cancelada",
    message: note.trim(),
    link: `/assistencia/${requestId}`,
  });

  revalidatePath("/assistencia/loja");
}

export async function approveDeadline(requestId: string) {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin");

  const admin = getSupabaseAdmin();
  const { data: current, error: fetchError } = await admin
    .from("service_requests")
    .select("requested_deadline, type, store_id, deadline_status")
    .eq("id", requestId)
    .single();
  if (fetchError || !current) throw new Error("Solicitação não encontrada.");
  requireManageAccess(profile, current.type);

  const { data: updated, error } = await admin
    .from("service_requests")
    .update({ deadline_status: "aprovado", approved_deadline: current.requested_deadline })
    .eq("id", requestId)
    .eq("deadline_status", current.deadline_status)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!updated) throw new Error("O prazo dessa solicitação já foi decidido por outra pessoa. Recarregue a página e tente de novo.");

  const note = current.requested_deadline ? `Prazo aprovado: ${current.requested_deadline}` : null;
  await admin.from("service_request_events").insert({
    request_id: requestId,
    actor_id: profile.id,
    event_type: "deadline_approved",
    note,
  });

  await notifyLoja(current.store_id, {
    type: "prazo_changed",
    title: "Prazo aprovado",
    message: note,
    link: `/assistencia/${requestId}`,
  });

  revalidatePath("/assistencia/fila");
  revalidatePath(`/assistencia/${requestId}`);
}

export async function rejectDeadline(requestId: string, newDate: string) {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin");
  if (!newDate) throw new Error("Informe a nova data proposta.");

  const admin = getSupabaseAdmin();
  const { data: current, error: fetchError } = await admin
    .from("service_requests")
    .select("type, store_id, deadline_status")
    .eq("id", requestId)
    .single();
  if (fetchError || !current) throw new Error("Solicitação não encontrada.");
  requireManageAccess(profile, current.type);

  const { data: updated, error } = await admin
    .from("service_requests")
    .update({ deadline_status: "recusado", approved_deadline: newDate })
    .eq("id", requestId)
    .eq("deadline_status", current.deadline_status)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!updated) throw new Error("O prazo dessa solicitação já foi decidido por outra pessoa. Recarregue a página e tente de novo.");

  const note = `Nova data proposta: ${newDate}`;
  await admin.from("service_request_events").insert({
    request_id: requestId,
    actor_id: profile.id,
    event_type: "deadline_rejected",
    note,
  });

  await notifyLoja(current.store_id, {
    type: "prazo_changed",
    title: "Nova data de prazo proposta",
    message: note,
    link: `/assistencia/${requestId}`,
  });

  revalidatePath("/assistencia/fila");
  revalidatePath(`/assistencia/${requestId}`);
}

export async function claimRequest(requestId: string) {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin", "sac");

  const admin = getSupabaseAdmin();
  const { data: current, error: fetchError } = await admin
    .from("service_requests")
    .select("status, type")
    .eq("id", requestId)
    .single();
  if (fetchError || !current) throw new Error("Solicitação não encontrada.");
  requireManageAccess(profile, current.type);

  const nextStatus = current.status === "aberta" ? "em_contato" : current.status;

  const { data: updated, error } = await admin
    .from("service_requests")
    .update({ assigned_to: profile.id, status: nextStatus })
    .eq("id", requestId)
    .eq("status", current.status)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!updated) throw new Error("Essa solicitação já foi atualizada por outra pessoa. Recarregue a página e tente de novo.");

  type RequestEvent = {
    request_id: string;
    actor_id: string;
    event_type: "assigned" | "status_changed";
    from_status?: string;
    to_status?: string;
  };
  const events: RequestEvent[] = [{ request_id: requestId, actor_id: profile.id, event_type: "assigned" }];
  if (nextStatus !== current.status) {
    events.push({
      request_id: requestId,
      actor_id: profile.id,
      event_type: "status_changed",
      from_status: current.status,
      to_status: nextStatus,
    });
  }
  await admin.from("service_request_events").insert(events);

  revalidatePath("/assistencia/fila");
  revalidatePath(`/assistencia/${requestId}`);
}

export async function updateStatus(requestId: string, newStatus: string, note?: string) {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin", "sac");
  if (!STATUSES.includes(newStatus as (typeof STATUSES)[number])) {
    throw new Error("Status inválido.");
  }
  if (newStatus === "remarcar" && !note?.trim()) {
    throw new Error("Informe o motivo da remarcação.");
  }

  const admin = getSupabaseAdmin();
  const { data: current, error: fetchError } = await admin
    .from("service_requests")
    .select("status, type, assembler_name, driver_name, store_id")
    .eq("id", requestId)
    .single();
  if (fetchError || !current) throw new Error("Solicitação não encontrada.");
  requireManageAccess(profile, current.type);

  // Só avança pra "em andamento" com alguém de fato definido — sem isso, fica
  // em "em contato" até alguém assumir. Chamado de troca de produto usa
  // motorista em vez de montador.
  const hasAssignee = current.type === "troca_produto" ? !!current.driver_name : !!current.assembler_name;
  if (newStatus === "em_andamento" && !hasAssignee) {
    const who = current.type === "troca_produto" ? "o motorista" : "o montador";
    throw new Error(`Defina ${who} antes de marcar como Em andamento.`);
  }

  const completedAt = newStatus === "concluida" || newStatus === "cancelada" ? new Date().toISOString() : null;

  const { data: updated, error } = await admin
    .from("service_requests")
    .update({ status: newStatus, completed_at: completedAt })
    .eq("id", requestId)
    .eq("status", current.status)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!updated) throw new Error("Essa solicitação já foi atualizada por outra pessoa. Recarregue a página e tente de novo.");

  await admin.from("service_request_events").insert({
    request_id: requestId,
    actor_id: profile.id,
    event_type: "status_changed",
    from_status: current.status,
    to_status: newStatus,
    note: note?.trim() || null,
  });

  await notifyLoja(current.store_id, {
    type: "status_changed",
    title: `Solicitação: ${STATUS_LABELS[newStatus] ?? newStatus}`,
    message: note?.trim() || null,
    link: `/assistencia/${requestId}`,
  });

  revalidatePath("/assistencia/fila");
  revalidatePath(`/assistencia/${requestId}`);
}

export async function addNote(requestId: string, note: string) {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin", "sac");
  const trimmed = note.trim();
  if (!trimmed) throw new Error("Nota vazia.");

  const admin = getSupabaseAdmin();
  const { data: current, error: fetchError } = await admin
    .from("service_requests")
    .select("type")
    .eq("id", requestId)
    .single();
  if (fetchError || !current) throw new Error("Solicitação não encontrada.");
  requireManageAccess(profile, current.type);

  const { error } = await admin.from("service_request_events").insert({
    request_id: requestId,
    actor_id: profile.id,
    event_type: "note_added",
    note: trimmed,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/assistencia/${requestId}`);
}

export async function addRequestPhoto(requestId: string, formData: FormData): Promise<void> {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin", "sac");

  const admin = getSupabaseAdmin();
  const { data: current, error: fetchError } = await admin
    .from("service_requests")
    .select("type")
    .eq("id", requestId)
    .single();
  if (fetchError || !current) throw new Error("Solicitação não encontrada.");
  requireManageAccess(profile, current.type);

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) throw new Error("Selecione uma foto.");
  const caption = String(formData.get("caption") ?? "");

  await saveRequestPhoto({ requestId, file, uploadedBy: profile.fullName, caption });
  revalidatePath(`/assistencia/${requestId}`);
}

export async function deleteRequestPhotoAsStaff(photoId: string): Promise<void> {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin", "sac");

  const info = await getPhotoForAuth(photoId);
  if (!info) throw new Error("Foto não encontrada.");

  const admin = getSupabaseAdmin();
  const { data: current } = await admin.from("service_requests").select("type").eq("id", info.requestId).single();
  if (current) requireManageAccess(profile, current.type);

  await deleteRequestPhoto(photoId);
  revalidatePath(`/assistencia/${info.requestId}`);
}

export async function setAssemblerName(requestId: string, assemblerName: string) {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin");
  const trimmed = assemblerName.trim();
  if (!trimmed) throw new Error("Informe o nome do montador.");

  const admin = getSupabaseAdmin();

  const { data: current } = await admin.from("service_requests").select("type").eq("id", requestId).single();
  if (!current) throw new Error("Solicitação não encontrada.");
  requireManageAccess(profile, current.type);
  if ((MANOEL_ONLY_TYPES as readonly string[]).includes(current.type) && trimmed !== MANOEL_ONLY_ASSEMBLER) {
    throw new Error(`Só ${MANOEL_ONLY_ASSEMBLER} pode ser responsável por ${REQUEST_TYPE_LABELS[current.type]?.toLowerCase() ?? current.type}.`);
  }

  await admin.from("assemblers").upsert({ name: trimmed }, { onConflict: "name" });

  const { error } = await admin.from("service_requests").update({ assembler_name: trimmed }).eq("id", requestId);
  if (error) throw new Error(error.message);

  await admin.from("service_request_events").insert({
    request_id: requestId,
    actor_id: profile.id,
    event_type: "note_added",
    note: `Montador definido: ${trimmed}`,
  });

  revalidatePath("/assistencia/fila");
  revalidatePath(`/assistencia/${requestId}`);
}

// Campo separado do "Motivo" (que é do gerente da loja e continua escondido
// do montador, ver ASSEMBLER_VIEW_COLUMNS em serviceRequests.ts) -- aqui só
// assistência/admin escreve, e o texto é pensado pra ser visto pelo
// montador, sem risco de vazar detalhe do gerente.
export async function setMontadorInstruction(requestId: string, note: string): Promise<void> {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin");

  const admin = getSupabaseAdmin();
  const { data: current } = await admin.from("service_requests").select("type").eq("id", requestId).single();
  if (!current) throw new Error("Solicitação não encontrada.");
  requireManageAccess(profile, current.type);

  const trimmed = note.trim();
  const { error } = await admin.from("service_requests").update({ montador_instruction: trimmed || null }).eq("id", requestId);
  if (error) throw new Error(error.message);

  await admin.from("service_request_events").insert({
    request_id: requestId,
    actor_id: profile.id,
    event_type: "note_added",
    note: trimmed ? `Instrução pro montador atualizada: ${trimmed}` : "Instrução pro montador removida.",
  });

  revalidatePath(`/assistencia/${requestId}`);
  revalidatePath("/assistencia/montador");
  revalidatePath(`/assistencia/montador/${requestId}`);
}

// Adicionar/remover produto era só do gerente da loja, e só enquanto o
// chamado ainda está "aberta" (ver editServiceRequestByGerente) -- isso
// continua valendo pra correção antes do atendimento começar. Mas no meio
// do atendimento (ex.: montador em loja, gerente pede pra montar/desmontar
// mais um item, o montador avisa a assistência) só a assistência/admin
// pode ajustar, em qualquer status -- daí essas duas actions à parte, sem
// trava de status nenhuma.
export async function addRequestItemByStaff(
  requestId: string,
  input: { product: string; partCode?: string; quantity: number; action?: "montar" | "desmontar" | null }
): Promise<void> {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin");
  const admin = getSupabaseAdmin();

  const { data: current } = await admin.from("service_requests").select("type").eq("id", requestId).single();
  if (!current) throw new Error("Solicitação não encontrada.");
  requireManageAccess(profile, current.type);

  const product = input.product.trim();
  if (!product) throw new Error("Informe o produto.");
  const quantity = Math.max(1, input.quantity || 1);

  const { error } = await admin.from("service_request_items").insert({
    request_id: requestId,
    product,
    part_code: input.partCode?.trim() || null,
    quantity,
    item_action: input.action ?? null,
  });
  if (error) throw new Error(error.message);

  await admin.from("service_request_events").insert({
    request_id: requestId,
    actor_id: profile.id,
    event_type: "note_added",
    note: `Produto adicionado: ${quantity > 1 ? `${quantity}x ` : ""}${product}${input.action ? ` (${input.action})` : ""}.`,
  });

  revalidatePath(`/assistencia/${requestId}`);
}

export async function removeRequestItemByStaff(requestId: string, itemId: string): Promise<void> {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin");
  const admin = getSupabaseAdmin();

  const { data: current } = await admin.from("service_requests").select("type").eq("id", requestId).single();
  if (!current) throw new Error("Solicitação não encontrada.");
  requireManageAccess(profile, current.type);

  const { data: item } = await admin
    .from("service_request_items")
    .select("product, quantity, payment_released")
    .eq("id", itemId)
    .eq("request_id", requestId)
    .maybeSingle();
  if (!item) throw new Error("Item não encontrado.");
  if (item.payment_released) throw new Error("Esse item já teve pagamento liberado — não dá pra remover.");

  const { error } = await admin.from("service_request_items").delete().eq("id", itemId);
  if (error) throw new Error(error.message);

  await admin.from("service_request_events").insert({
    request_id: requestId,
    actor_id: profile.id,
    event_type: "note_added",
    note: `Produto removido: ${item.quantity > 1 ? `${item.quantity}x ` : ""}${item.product}.`,
  });

  revalidatePath(`/assistencia/${requestId}`);
}

// Liga/desliga a necessidade complementar (montagem<->desmontagem) num
// chamado já criado — a loja pode ter esquecido de marcar, ou a assistência
// percebe depois que precisa das duas coisas na mesma visita.
export async function setComboMontagemDesmontagem(requestId: string, value: boolean) {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin");

  const admin = getSupabaseAdmin();
  const { data: current } = await admin.from("service_requests").select("type").eq("id", requestId).single();
  if (!current || (current.type !== "montagem" && current.type !== "desmontagem")) {
    throw new Error("Isso só se aplica a chamados de montagem ou desmontagem.");
  }
  requireManageAccess(profile, current.type);

  const { error } = await admin.from("service_requests").update({ combo_montagem_desmontagem: value }).eq("id", requestId);
  if (error) throw new Error(error.message);

  const complemento = current.type === "montagem" ? "desmontagem" : "montagem";
  await admin.from("service_request_events").insert({
    request_id: requestId,
    actor_id: profile.id,
    event_type: "note_added",
    note: value ? `Também precisa de ${complemento} nessa visita.` : `Removida a necessidade de ${complemento}.`,
  });

  revalidatePath("/assistencia/fila");
  revalidatePath(`/assistencia/${requestId}`);
}

export async function setDriverName(requestId: string, driverName: string) {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin", "sac");
  const trimmed = driverName.trim();
  if (!trimmed) throw new Error("Informe o nome do motorista.");

  const admin = getSupabaseAdmin();
  const { data: current, error: fetchError } = await admin
    .from("service_requests")
    .select("type")
    .eq("id", requestId)
    .single();
  if (fetchError || !current) throw new Error("Solicitação não encontrada.");
  requireManageAccess(profile, current.type);

  const name = await resolveDriverName(trimmed);
  await admin.from("drivers").upsert({ name }, { onConflict: "name" });

  const { error } = await admin.from("service_requests").update({ driver_name: name }).eq("id", requestId);
  if (error) throw new Error(error.message);

  await admin.from("service_request_events").insert({
    request_id: requestId,
    actor_id: profile.id,
    event_type: "note_added",
    note: `Motorista definido: ${name}`,
  });

  revalidatePath("/assistencia/fila");
  revalidatePath(`/assistencia/${requestId}`);
}

export async function setSchedule(
  requestId: string,
  scheduledDate: string,
  shift: string,
  scheduledTime: string,
  rota?: string,
  rotaExceptionNote?: string
) {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin");
  if (shift && !SHIFTS.includes(shift as (typeof SHIFTS)[number])) {
    throw new Error("Turno inválido.");
  }

  const admin = getSupabaseAdmin();
  const { data: current } = await admin.from("service_requests").select("type").eq("id", requestId).single();
  if (!current) throw new Error("Solicitação não encontrada.");
  requireManageAccess(profile, current.type);

  let rotaValue: string | null = null;
  let exceptionNote: string | null = null;
  if (scheduledDate && rota) {
    if (!isRota(rota)) throw new Error("Rota inválida.");
    const config = await getRotaWeekdayConfig();
    const expectedRota = getRotaForDate(scheduledDate, config);
    const isException = expectedRota !== rota;
    if (isException && !rotaExceptionNote?.trim()) {
      const expectedLabel = expectedRota ? ROTA_LABELS[expectedRota] : "nenhuma rota";
      throw new Error(`Essa data é de ${expectedLabel}, não de ${ROTA_LABELS[rota]} — informe o motivo do encaixe fora da rota.`);
    }
    rotaValue = rota;
    // Só grava a nota quando a data realmente diverge da rota esperada --
    // senão uma nota antiga "gruda" mesmo depois do chamado ser reagendado
    // pra um dia normal da rota, e o motorista continua vendo o aviso de
    // exceção sem mais fazer sentido.
    exceptionNote = isException ? rotaExceptionNote?.trim() || null : null;
  }

  const { error } = await admin
    .from("service_requests")
    .update({
      scheduled_date: scheduledDate || null,
      shift: shift || null,
      scheduled_time: scheduledTime || null,
      rota: rotaValue,
      rota_exception_note: exceptionNote,
    })
    .eq("id", requestId);
  if (error) throw new Error(error.message);

  const shiftLabel = SHIFT_LABELS[shift] ?? shift;
  const rotaNote = rotaValue ? ` · rota ${ROTA_LABELS[rotaValue as keyof typeof ROTA_LABELS]}${exceptionNote ? ` (encaixe: ${exceptionNote})` : ""}` : "";
  await admin.from("service_request_events").insert({
    request_id: requestId,
    actor_id: profile.id,
    event_type: "note_added",
    note: scheduledDate
      ? `Visita agendada: ${scheduledDate}${scheduledTime ? ` às ${scheduledTime}` : ""}${shift ? ` (${shiftLabel})` : ""}${rotaNote}`
      : "Agendamento removido.",
  });

  revalidatePath("/assistencia/fila");
  revalidatePath("/assistencia/agenda");
  revalidatePath(`/assistencia/${requestId}`);
}

export async function setSacCategory(requestId: string, category: string) {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin", "sac");
  if (!SAC_CATEGORIES.includes(category as (typeof SAC_CATEGORIES)[number])) {
    throw new Error("Categoria inválida.");
  }

  const admin = getSupabaseAdmin();
  const { data: current, error: fetchError } = await admin
    .from("service_requests")
    .select("type")
    .eq("id", requestId)
    .single();
  if (fetchError || !current) throw new Error("Solicitação não encontrada.");
  requireManageAccess(profile, current.type);

  const { error } = await admin.from("service_requests").update({ sac_category: category }).eq("id", requestId);
  if (error) throw new Error(error.message);

  await admin.from("service_request_events").insert({
    request_id: requestId,
    actor_id: profile.id,
    event_type: "note_added",
    note: `Categoria SAC definida: ${SAC_CATEGORY_LABELS[category] ?? category}.`,
  });

  revalidatePath("/assistencia/fila");
  revalidatePath(`/assistencia/${requestId}`);
}

export async function setLegalDeadline(requestId: string, newDate: string) {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin", "sac");
  if (!newDate) throw new Error("Informe uma data.");

  const admin = getSupabaseAdmin();
  const { data: current, error: fetchError } = await admin
    .from("service_requests")
    .select("type")
    .eq("id", requestId)
    .single();
  if (fetchError || !current) throw new Error("Solicitação não encontrada.");
  requireManageAccess(profile, current.type);

  const { error } = await admin.from("service_requests").update({ legal_deadline: newDate }).eq("id", requestId);
  if (error) throw new Error(error.message);

  await admin.from("service_request_events").insert({
    request_id: requestId,
    actor_id: profile.id,
    event_type: "note_added",
    note: `Prazo legal ajustado para ${newDate}.`,
  });

  revalidatePath("/assistencia/fila");
  revalidatePath(`/assistencia/${requestId}`);
}

export async function setEscalationRisk(requestId: string, atRisk: boolean) {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin", "sac");

  const admin = getSupabaseAdmin();
  const { data: current, error: fetchError } = await admin
    .from("service_requests")
    .select("type")
    .eq("id", requestId)
    .single();
  if (fetchError || !current) throw new Error("Solicitação não encontrada.");
  requireManageAccess(profile, current.type);

  const { error } = await admin.from("service_requests").update({ escalation_risk: atRisk }).eq("id", requestId);
  if (error) throw new Error(error.message);

  await admin.from("service_request_events").insert({
    request_id: requestId,
    actor_id: profile.id,
    event_type: "note_added",
    note: atRisk ? "Marcado como risco de escalonamento (Procon/ReclameAqui)." : "Risco de escalonamento removido.",
  });

  revalidatePath("/assistencia/fila");
  revalidatePath(`/assistencia/${requestId}`);
}

export async function updateRequestDetails(
  requestId: string,
  _state: FormState,
  formData: FormData
): Promise<FormState> {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin", "sac");

  const clientName = String(formData.get("client_name") ?? "").trim();
  if (!clientName) return { error: "Informe o nome do cliente." };
  const storeId = String(formData.get("store_id") ?? "").trim();
  if (!storeId) return { error: "Selecione a loja." };

  const admin = getSupabaseAdmin();
  const { data: currentRequest } = await admin.from("service_requests").select("type").eq("id", requestId).single();
  if (!currentRequest) return { error: "Solicitação não encontrada." };
  requireManageAccess(profile, currentRequest.type);

  const addressNumberFields = readAddressNumberFields(formData, currentRequest.type);
  if (addressNumberFields.error) return { error: addressNumberFields.error };

  const { error } = await admin
    .from("service_requests")
    .update({
      store_id: storeId,
      order_code: emptyToNull(formData.get("order_code")),
      client_name: clientName,
      client_cpf: emptyToNull(formData.get("client_cpf")),
      client_phone: emptyToNull(formData.get("client_phone")),
      client_address: emptyToNull(formData.get("client_address")),
      client_address_number: emptyToNull(addressNumberFields.number),
      client_is_apartment: addressNumberFields.isApartment,
      client_address_complement: emptyToNull(addressNumberFields.complement),
      client_neighborhood: emptyToNull(formData.get("client_neighborhood")),
      reason: emptyToNull(formData.get("reason")),
      montador_instruction: emptyToNull(formData.get("montador_instruction")),
      restriction_note: emptyToNull(formData.get("restriction_note")),
      notes: emptyToNull(formData.get("notes")),
      seller_name: emptyToNull(formData.get("seller_name")),
      invoice_number: emptyToNull(formData.get("invoice_number")),
    })
    .eq("id", requestId);

  if (error) {
    return { error: `Não foi possível salvar: ${error.message}` };
  }

  await admin.from("service_request_events").insert({
    request_id: requestId,
    actor_id: profile.id,
    event_type: "edited",
    note: "Dados da solicitação corrigidos.",
  });

  revalidatePath("/assistencia/fila");
  revalidatePath(`/assistencia/${requestId}`);
  redirect(`/assistencia/${requestId}`);
}

// Criação rápida a partir da Agenda ou de Pagamentos: cria a solicitação com só
// o essencial (evita ter que passar pela tela cheia de "Nova solicitação" pra
// coisas pontuais, do jeito que dava pra digitar direto na planilha).
export async function createQuickRequest(_state: FormState, formData: FormData): Promise<FormState> {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin");

  const storeId = String(formData.get("store_id") ?? "").trim();
  if (!storeId) return { error: "Selecione a loja." };

  const type = String(formData.get("type") ?? "");
  if (!REQUEST_TYPES.includes(type as (typeof REQUEST_TYPES)[number])) {
    return { error: "Tipo de solicitação inválido." };
  }
  if (profile.role === "assistencia" && (SAC_MANAGED_TYPES as readonly string[]).includes(type)) {
    return { error: "Esse tipo de solicitação é gerenciado pelo SAC." };
  }

  const clientName = String(formData.get("client_name") ?? "").trim();
  if (!clientName) return { error: "Informe o nome do cliente." };

  const clientPhone = String(formData.get("client_phone") ?? "").trim();
  if (!clientPhone) return { error: "Informe o telefone." };

  const clientAddress = String(formData.get("client_address") ?? "").trim();
  if (!clientAddress) return { error: "Informe o endereço." };

  const addressNumberFields = readAddressNumberFields(formData, type);
  if (addressNumberFields.error) return { error: addressNumberFields.error };

  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { error: "Informe o que precisa ser feito." };

  const shift = String(formData.get("shift") ?? "").trim();
  if (shift && !SHIFTS.includes(shift as (typeof SHIFTS)[number])) {
    return { error: "Turno inválido." };
  }

  const assemblerName = emptyToNull(formData.get("assembler_name"));
  if (assemblerName && (MANOEL_ONLY_TYPES as readonly string[]).includes(type) && assemblerName !== MANOEL_ONLY_ASSEMBLER) {
    return { error: `Só ${MANOEL_ONLY_ASSEMBLER} pode ser responsável por ${REQUEST_TYPE_LABELS[type]?.toLowerCase() ?? type}.` };
  }
  // Só faz sentido pra montagem/desmontagem — pedir os dois numa visita só,
  // sem precisar abrir dois chamados separados pro mesmo cliente.
  const comboMontagemDesmontagem = (type === "montagem" || type === "desmontagem") && formData.get("combo_montagem_desmontagem") === "on";

  function parseItems(prefix: string): { product: string; quantity: number; partCode: string | null; unitValue: number | null }[] | { error: string } {
    const products = formData.getAll(prefix + "_product").map((v) => String(v).trim());
    const quantities = formData.getAll(prefix + "_quantity").map((v) => {
      const n = parseInt(String(v), 10);
      return Number.isFinite(n) && n > 0 ? n : 1;
    });
    const codes = formData.getAll(prefix + "_code").map((v) => String(v).trim() || null);
    const unitValuesRaw = formData.getAll(prefix + "_unit_value").map((v) => String(v).trim());
    const unitValues: (number | null)[] = [];
    for (const raw of unitValuesRaw) {
      if (!raw) {
        unitValues.push(null);
        continue;
      }
      const parsed = parseFloat(raw.replace(",", "."));
      if (!Number.isFinite(parsed) || parsed < 0) return { error: "Valor inválido." };
      unitValues.push(parsed);
    }
    return products
      .map((product, i) => ({ product, quantity: quantities[i] ?? 1, partCode: codes[i] ?? null, unitValue: unitValues[i] ?? null }))
      .filter((item) => item.product.length > 0);
  }

  // Sem combo, "item" é a lista única de sempre (a ação já é o type do
  // chamado, quando aplicável). Com combo, "item" continua sendo os
  // produtos do type principal e "item_secondary" os da ação oposta -- ver
  // QuickCreateRequestForm.tsx.
  const primaryAction: "montar" | "desmontar" | null = comboMontagemDesmontagem ? (type === "montagem" ? "montar" : "desmontar") : null;
  const secondaryAction: "montar" | "desmontar" = primaryAction === "montar" ? "desmontar" : "montar";

  const primaryItemsResult = parseItems("item");
  if ("error" in primaryItemsResult) return { error: primaryItemsResult.error };
  const primaryItems = primaryItemsResult.map((item) => ({ ...item, action: primaryAction }));

  let secondaryItems: (typeof primaryItems)[number][] = [];
  if (comboMontagemDesmontagem) {
    const secondaryItemsResult = parseItems("item_secondary");
    if ("error" in secondaryItemsResult) return { error: secondaryItemsResult.error };
    secondaryItems = secondaryItemsResult.map((item) => ({ ...item, action: secondaryAction }));
    if (secondaryItems.length === 0) {
      return { error: `Informe pelo menos um produto pra ${secondaryAction === "montar" ? "montar" : "desmontar"} (a outra ação da visita combo).` };
    }
  }
  const items = [...primaryItems, ...secondaryItems];

  const admin = getSupabaseAdmin();

  if (assemblerName) {
    await admin.from("assemblers").upsert({ name: assemblerName }, { onConflict: "name" });
  }

  const { data, error } = await admin
    .from("service_requests")
    .insert({
      type,
      store_id: storeId,
      requested_by: profile.id,
      client_name: clientName,
      client_phone: clientPhone,
      client_address: clientAddress,
      client_address_number: emptyToNull(addressNumberFields.number),
      client_is_apartment: addressNumberFields.isApartment,
      client_address_complement: emptyToNull(addressNumberFields.complement),
      client_protheus_code: emptyToNull(formData.get("client_protheus_code")),
      reason: reason,
      scheduled_date: emptyToNull(formData.get("scheduled_date")),
      scheduled_time: emptyToNull(formData.get("scheduled_time")),
      shift: shift || null,
      assembler_name: assemblerName,
      combo_montagem_desmontagem: comboMontagemDesmontagem,
      // Criação rápida não coleta prazo pedido pela loja, então não há nada
      // pra "aprovar" — sem isso, o padrão do banco (pendente) fazia a tela
      // sempre mostrar "prazo pendente de aprovação" sem sentido.
      deadline_status: "aprovado",
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: `Não foi possível criar: ${error?.message ?? "erro desconhecido"}` };
  }

  if (items.length > 0) {
    const { error: itemsError } = await admin.from("service_request_items").insert(
      items.map((item) => ({
        request_id: data.id,
        product: item.product,
        part_code: item.partCode,
        quantity: item.quantity,
        unit_value: item.unitValue,
        item_action: item.action,
      }))
    );
    if (itemsError) {
      return { error: `Solicitação criada, mas falhou ao salvar os itens: ${itemsError.message}` };
    }
  }

  await admin.from("service_request_events").insert({
    request_id: data.id,
    actor_id: profile.id,
    event_type: "created",
    to_status: "aberta",
  });

  revalidatePath("/assistencia/fila");
  revalidatePath("/assistencia/agenda");
  revalidatePath("/assistencia/pagamentos");
  redirect(`/assistencia/${data.id}`);
}

const SAC_REQUEST_TYPES = ["troca_produto", "entrega_produto", "envio_peca", "notificacao_externa", "montagem"] as const;

// Criação de chamado pelo SAC — troca de produto (recolher o errado/avariado
// e entregar o correto numa rota só, ver src/lib/driverAuth.ts), entrega de
// produto sem recolhimento, envio de peça avulsa (independente do módulo de
// Peças/fornecedores), notificação externa, ou montagem (SAC só faz o
// intake -- gerenciar daí pra frente, agendar e atribuir montador continua
// exclusivo de assistência/admin, mesma regra de ASSISTENCIA_MANAGED_TYPES
// que já vale pra montagem criada pela loja). Mesmo formato do relatório
// logístico que já existia em planilha: cliente, endereço, telefone, produto
// e a instrução de recolhimento em texto livre.
export async function createSacRequest(_state: FormState, formData: FormData): Promise<FormState> {
  const profile = await getProfile();
  requireRole(profile, "admin", "sac");

  const storeId = String(formData.get("store_id") ?? "").trim();
  if (!storeId) return { error: "Selecione a loja." };

  const type = String(formData.get("type") ?? "troca_produto");
  if (!(SAC_REQUEST_TYPES as readonly string[]).includes(type)) {
    return { error: "Tipo inválido." };
  }

  const clientName = String(formData.get("client_name") ?? "").trim();
  if (!clientName) return { error: "Informe o nome do cliente." };

  const clientPhone = String(formData.get("client_phone") ?? "").trim();
  if (!clientPhone) return { error: "Informe o telefone." };

  const clientAddress = String(formData.get("client_address") ?? "").trim();
  if (!clientAddress) return { error: "Informe o endereço." };

  const clientNeighborhood = String(formData.get("client_neighborhood") ?? "").trim();
  if (!clientNeighborhood) return { error: "Informe o bairro." };

  const addressNumberFields = readAddressNumberFields(formData, type);
  if (addressNumberFields.error) return { error: addressNumberFields.error };

  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { error: "Informe o motivo." };

  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    return { error: "Anexe uma foto ou PDF da notificação." };
  }

  const driverNameInput = emptyToNull(formData.get("driver_name"));
  const urgent = formData.get("urgent") === "on";
  // Só faz sentido pra montagem -- mesma ideia de createQuickRequest, pedir
  // pra desmontar o móvel velho na mesma visita sem abrir um segundo chamado.
  const comboMontagemDesmontagem = type === "montagem" && formData.get("combo_montagem_desmontagem") === "on";

  function parseItems(prefix: string): { product: string; quantity: number; partCode: string | null }[] {
    const products = formData.getAll(prefix + "_product").map((v) => String(v).trim());
    const quantities = formData.getAll(prefix + "_quantity").map((v) => {
      const n = parseInt(String(v), 10);
      return Number.isFinite(n) && n > 0 ? n : 1;
    });
    const codes = formData.getAll(prefix + "_code").map((v) => String(v).trim() || null);
    return products
      .map((product, i) => ({ product, quantity: quantities[i] ?? 1, partCode: codes[i] ?? null }))
      .filter((item) => item.product.length > 0);
  }

  // "item" é a lista principal (produto a entregar, ou a montar quando o
  // type é montagem); "item_secondary" só existe com o combo marcado, e é
  // sempre "a desmontar" (SAC não cria desmontagem isolada).
  const primaryItems = parseItems("item").map((item) => ({ ...item, action: comboMontagemDesmontagem ? ("montar" as const) : null }));
  const secondaryItems = comboMontagemDesmontagem
    ? parseItems("item_secondary").map((item) => ({ ...item, action: "desmontar" as const }))
    : [];
  if (comboMontagemDesmontagem && secondaryItems.length === 0) {
    return { error: "Informe pelo menos um móvel pra desmontar (a outra ação da visita combo)." };
  }
  const items = [...primaryItems, ...secondaryItems];

  const admin = getSupabaseAdmin();
  const driverName = driverNameInput ? await resolveDriverName(driverNameInput) : null;
  if (driverName) {
    await admin.from("drivers").upsert({ name: driverName }, { onConflict: "name" });
  }

  // Anexo é obrigatório -- sobe o arquivo ANTES de criar o ticket (o path só
  // depende do id, gerado aqui antecipadamente, não da linha existir de
  // fato). Se o upload falhar, nenhum ticket chega a ser criado, então não
  // sobra chamado "válido" sem anexo por causa de uma falha no meio do
  // caminho.
  const requestId = randomUUID();
  let photoPath: string;
  try {
    photoPath = await uploadPendingRequestPhoto(requestId, photo);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Não foi possível enviar o anexo." };
  }

  const { data, error } = await admin
    .from("service_requests")
    .insert({
      id: requestId,
      type,
      store_id: storeId,
      requested_by: profile.id,
      client_name: clientName,
      client_phone: clientPhone,
      client_address: clientAddress,
      client_address_number: emptyToNull(addressNumberFields.number),
      client_is_apartment: addressNumberFields.isApartment,
      client_address_complement: emptyToNull(addressNumberFields.complement),
      client_neighborhood: clientNeighborhood,
      client_protheus_code: emptyToNull(formData.get("client_protheus_code")),
      reason: reason,
      restriction_note: emptyToNull(formData.get("restriction_note")),
      driver_name: driverName,
      shift: urgent ? "urgencia" : null,
      sac_category: type === "notificacao_externa" ? emptyToNull(formData.get("sac_category")) : null,
      combo_montagem_desmontagem: comboMontagemDesmontagem,
      // Criado direto pelo SAC, não pela loja — não há prazo pra aprovar.
      deadline_status: "aprovado",
    })
    .select("id, ticket_number")
    .single();

  if (error || !data) {
    await discardPendingRequestPhoto(photoPath);
    return { error: `Não foi possível criar: ${error?.message ?? "erro desconhecido"}` };
  }

  if (items.length > 0) {
    const { error: itemsError } = await admin.from("service_request_items").insert(
      items.map((item) => ({
        request_id: data.id,
        product: item.product,
        part_code: item.partCode,
        quantity: item.quantity,
        item_action: item.action,
      }))
    );
    if (itemsError) {
      return { error: `Solicitação #${data.ticket_number} criada, mas falhou ao salvar os itens: ${itemsError.message}` };
    }
  }

  if (type === "notificacao_externa") {
    const protocolNumber = `SAC-${new Date().getFullYear()}-${data.id.slice(0, 8).toUpperCase()}`;
    const legalDeadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await admin
      .from("service_requests")
      .update({ protocol_number: protocolNumber, legal_deadline: legalDeadline })
      .eq("id", data.id);
  }

  await admin.from("service_request_events").insert({
    request_id: data.id,
    actor_id: profile.id,
    event_type: "created",
    to_status: "aberta",
  });

  try {
    await attachPendingRequestPhoto({ requestId: data.id, path: photoPath, uploadedBy: profile.fullName });
  } catch {
    // O arquivo já subiu, mas não deu pra associar ao ticket -- como o
    // anexo é obrigatório, desfaz o ticket inteiro (cascade cuida de
    // item/evento já criados) em vez de deixar um chamado "válido" sem
    // anexo. O usuário só precisa tentar de novo.
    await admin.from("service_requests").delete().eq("id", data.id);
    return { error: "Não foi possível concluir o anexo da solicitação. Tente de novo." };
  }

  revalidatePath("/assistencia/sac");
  redirect(`/assistencia/${data.id}`);
}

// Chamada a partir do painel da loja (/assistencia/loja, protegido por login
// de loja + PIN — ver src/lib/lojaAuth.ts), pra propor uma nova data mesmo
// depois que a assistência já tinha definido uma. Reabre a negociação de
// prazo (mesmo fluxo de aprovação já existente). Verifica que o chamado é da
// UMA DAS lojas do gerente autenticado — sem isso, qualquer sessão de loja
// conseguiria mudar o prazo de um chamado de outra loja.
export async function proposeNewDeadline(requestId: string, newDate: string) {
  if (!newDate) throw new Error("Informe uma data.");

  const gerenteName = await getLojaGerenteSession();
  if (!gerenteName) throw new Error("Sessão expirada. Faça login de novo.");
  const gerenteStoreIds = await getGerenteStoreIds(gerenteName);
  if (gerenteStoreIds.length === 0) throw new Error("Gerente sem loja vinculada.");

  const admin = getSupabaseAdmin();
  const { data: request, error: fetchError } = await admin
    .from("service_requests")
    .select("store_id")
    .eq("id", requestId)
    .maybeSingle();
  if (fetchError || !request || !gerenteStoreIds.includes(request.store_id)) {
    throw new Error("Esse chamado não é de uma loja sua.");
  }

  const { error } = await admin
    .from("service_requests")
    .update({ requested_deadline: newDate, deadline_status: "pendente" })
    .eq("id", requestId);
  if (error) throw new Error(error.message);

  await admin.from("service_request_events").insert({
    request_id: requestId,
    actor_id: null,
    event_type: "note_added",
    note: `${gerenteName} (loja) propôs nova data: ${newDate}.`,
  });

  revalidatePath("/assistencia/loja");
  revalidatePath("/assistencia/fila");
  revalidatePath(`/assistencia/${requestId}`);
}

const LOJA_STORE_COOKIE = "loja_store_pref";

// Sem sessão — lembra qual loja a pessoa escolheu no painel público, pra não
// precisar reselecionar toda vez que entrar do mesmo aparelho.
export async function setLojaStorePreference(storeId: string) {
  const cookieStore = await cookies();
  if (storeId) {
    cookieStore.set(LOJA_STORE_COOKIE, storeId, {
      httpOnly: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  } else {
    cookieStore.delete(LOJA_STORE_COOKIE);
  }
}

export async function getLojaStorePreference(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(LOJA_STORE_COOKIE)?.value ?? null;
}
