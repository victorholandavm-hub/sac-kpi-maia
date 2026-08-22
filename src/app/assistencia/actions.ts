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
  DELIVERY_REQUEST_TYPES,
  ALL_REQUEST_TYPES,
  CAUSA_RAIZ_OPTIONS,
} from "@/lib/assistenciaLabels";
import { notifyLoja } from "@/lib/notifications";
import { resolveDriverName, listOwnStoreAssemblers } from "@/lib/payments";
import { saveRequestPhoto, getPhotoForAuth, deleteRequestPhoto } from "@/lib/servicePhotos";
import { randomUUID } from "crypto";
import { getLojaGerenteSession } from "@/app/assistencia/loja-actions";
import { getGerenteStoreIds } from "@/lib/gerentes";
import { getClientIp, checkAndRecordPublicSubmission } from "@/lib/rateLimit";
import { checkIpRateLimit, recordFailedIpAttempt } from "@/lib/ipRateLimit";
import { isRota, getRotaDriverAssignments, getAvailableRotasForDate, ROTA_LABELS, type AvailableRota } from "@/lib/rotas";
import { sanitizeOrFilterValue } from "@/lib/searchFilter";
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
import { ADDRESS_NUMBER_REQUIRED_TYPES, listDayLoad, type DayLoadItem } from "@/lib/serviceRequests";

const REQUEST_TYPES = [
  "montagem",
  "desmontagem",
  "recolhimento",
  "envio_peca",
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

// Número é obrigatório nos tipos com visita/entrega física (ver
// ADDRESS_NUMBER_REQUIRED_TYPES); apto/bloco só é obrigatório quando a
// pessoa marcou "é apartamento" — usado nas 3 telas de criação (loja, SAC,
// assistência/admin) e nas 2 de edição.
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

// Usado no formulário de criação (QuickCreateRequestForm) pra mostrar a
// carga do dia assim que a assistência escolhe a data agendada -- ver
// listDayLoad em serviceRequests.ts.
export async function getDayLoadAction(date: string): Promise<DayLoadItem[]> {
  await getProfile();
  return listDayLoad(date);
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
  // Loja/gerente só pede montagem e desmontagem (pedido do Victor
  // 18/08/2026: "recolhimento de peça, entrega/envio de peça, troca de
  // peça, vistoria e notificação externa são notificações de assistência,
  // só Assistência e SAC pedem, nunca a loja") -- já não são oferecidos no
  // <select> de PublicRequestForm.tsx, isso aqui é a mesma trava do lado do
  // servidor, pra um POST direto (fora da tela) não conseguir criar um
  // mesmo assim. Mais restrito que REQUEST_TYPES (que ainda vale pra
  // createQuickRequest, usado pela assistência).
  if (type !== "montagem" && type !== "desmontagem") {
    return { error: "Tipo de solicitação inválido." };
  }

  // Loja com montador próprio (Mamanguape, Campina Grande...) pode escolher
  // direto quem vai montar/desmontar, sem esperar a assistência atribuir --
  // nunca confia no nome que veio do form sem checar contra quem está
  // cadastrado pra essa loja (ver listOwnStoreAssemblers), senão dava pra
  // "atribuir" qualquer nome via devtools.
  let assemblerName: string | null = null;
  if (type === "montagem" || type === "desmontagem") {
    const requestedAssembler = String(formData.get("assembler_name") ?? "").trim();
    if (requestedAssembler) {
      const ownAssemblers = await listOwnStoreAssemblers(storeId);
      if (!ownAssemblers.includes(requestedAssembler)) {
        return { error: "Montador inválido." };
      }
      assemblerName = requestedAssembler;
    }
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

    // Só os tipos que envolvem visita/entrega física exigem endereço -- os
    // outros nem mostram esse campo no formulário (ver showAddress em
    // PublicRequestForm). Mesma lista de ADDRESS_NUMBER_REQUIRED_TYPES.
    if ((ADDRESS_NUMBER_REQUIRED_TYPES as string[]).includes(type)) {
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

  if (items.length === 0) {
    return { error: "Informe pelo menos um produto." };
  }
  if (comboMontagemDesmontagem && secondaryItems.length === 0) {
    return {
      error: `Informe pelo menos um produto pra ${secondaryAction === "montar" ? "montar" : "desmontar"} (a outra ação da visita combo).`,
    };
  }
  // Pedido do Victor 15/08/2026: código do produto passa a ser obrigatório
  // pra montagem/desmontagem -- antes era só uma sugestão pra autopreencher
  // o nome (ver hint em PublicRequestForm.tsx).
  if (type === "montagem" || type === "desmontagem") {
    const semCodigo = items.find((item) => !item.partCode);
    if (semCodigo) return { error: `Informe o código do produto "${semCodigo.product}".` };
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
      combo_montagem_desmontagem: comboMontagemDesmontagem,
      assembler_name: assemblerName,
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

  await admin.from("service_request_events").insert({
    request_id: data.id,
    actor_id: null,
    event_type: "created",
    to_status: "aberta",
  });

  if (assemblerName) {
    await admin.from("service_request_events").insert({
      request_id: data.id,
      actor_id: null,
      event_type: "note_added",
      note: `Montador definido: ${assemblerName}`,
    });
  }

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
    .select("type, status, store_id, client_name, order_code, assembler_name")
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

  // Mesma validação de createPublicRequest -- nunca confia no nome vindo do
  // form sem checar contra quem está cadastrado pra essa loja. Só mexe no
  // campo quando a loja TEM montador próprio (o campo só existe no form
  // nesse caso, ver EditServiceRequestForm) -- nas demais lojas o valor
  // atual fica intacto, senão uma edição comum apagaria o montador que a
  // assistência já tivesse atribuído por fora.
  let assemblerName = current.assembler_name as string | null;
  if (type === "montagem" || type === "desmontagem") {
    const ownAssemblers = await listOwnStoreAssemblers(current.store_id);
    if (ownAssemblers.length > 0) {
      const requestedAssembler = String(formData.get("assembler_name") ?? "").trim();
      if (requestedAssembler) {
        if (!ownAssemblers.includes(requestedAssembler)) {
          return { error: "Montador inválido." };
        }
        assemblerName = requestedAssembler;
      } else {
        assemblerName = null;
      }
    }
  }

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

    if ((ADDRESS_NUMBER_REQUIRED_TYPES as string[]).includes(type)) {
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
      assembler_name: assemblerName,
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

  if (assemblerName !== current.assembler_name) {
    await admin.from("service_request_events").insert({
      request_id: requestId,
      actor_id: null,
      event_type: "note_added",
      note: assemblerName ? `Montador definido: ${assemblerName}` : "Montador removido.",
    });
  }

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
    .select("status, type, assembler_name, driver_name, store_id, deadline_status")
    .eq("id", requestId)
    .single();
  if (fetchError || !current) throw new Error("Solicitação não encontrada.");
  requireManageAccess(profile, current.type);

  // Só avança pra "em andamento" com alguém de fato definido — sem isso, fica
  // em "em contato" até alguém assumir. Os 3 tipos de entrega (troca/entrega
  // de produto, envio de peça) usam motorista; o resto (montagem/
  // desmontagem/recolhimento/troca de peça/vistoria) usa montador (bug real
  // achado 18/08/2026: só checava troca_produto, então entrega_produto e
  // envio_peca caíam no ramo de montador -- pedia "Defina o montador" e
  // olhava assembler_name num chamado que nunca teve montador nenhum,
  // travava mesmo com o motorista já definido).
  const isDeliveryType = (DELIVERY_REQUEST_TYPES as readonly string[]).includes(current.type);
  const hasAssignee = isDeliveryType ? !!current.driver_name : !!current.assembler_name;
  if (newStatus === "em_andamento" && !hasAssignee) {
    const who = isDeliveryType ? "o motorista" : "o montador";
    throw new Error(`Defina ${who} antes de marcar como Em andamento.`);
  }

  const completedAt = newStatus === "concluida" || newStatus === "cancelada" ? new Date().toISOString() : null;

  // Prazo não pode ficar "pendente de aprovação" pra sempre num chamado já
  // concluído (pedido do Victor 18/08/2026, achado em montagem/desmontagem/
  // vistoria -- criado pela loja com prazo pedido, mas a assistência nunca
  // chegou a aprovar/recusar antes de já resolver o chamado direto). Concluir
  // aprova implicitamente com a data de hoje -- não faz sentido pedir mais
  // aprovação de prazo pra algo que já terminou.
  const deadlineFields =
    newStatus === "concluida" && current.deadline_status === "pendente"
      ? { deadline_status: "aprovado" as const, approved_deadline: (completedAt as string).slice(0, 10) }
      : {};

  const { data: updated, error } = await admin
    .from("service_requests")
    .update({ status: newStatus, completed_at: completedAt, ...deadlineFields })
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

// Produto trocado pode vir errado/avariado de novo -- em vez de reabrir o
// MESMO chamado (como era até 18/08/2026, e apagava a 1ª troca: itens, fotos
// e data de conclusão ficavam sobrescritos pela rodada seguinte), cria um
// chamado NOVO, com número próprio, ligado ao original via
// parent_request_id (ver 0090_exchange_parent_request.sql). O original fica
// congelado como está -- "concluída" pra sempre, com o que foi de fato
// entregue/recolhido naquela rodada. Agenda (data/hora/turno/rota/motorista)
// vem copiada da rodada anterior como sugestão -- pedido do Victor
// 18/08/2026 ("tem que vir sugerido na mesma rota da notificação anterior"):
// o sistema não tem o conceito de "rota sem data" (a lista de disponíveis
// sempre depende de uma data), então copiar só a rota não bastava -- ao
// trocar a data pro dia real da nova visita, a validação normal de
// rota-por-dia (getAvailableRotasForDate) entra em ação do mesmo jeito que
// em qualquer edição.
export async function createExchangeChild(
  requestId: string,
  opts: {
    reason: string;
    sameProduct: boolean;
    causaRaiz: string;
    causaCarga?: string;
    causaConferente?: string;
    driverNameForError?: string;
    causaRaizDetalhe?: string;
  }
): Promise<{ id: string; ticketNumber: number }> {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin", "sac");
  const reasonTrimmed = opts.reason.trim();
  if (!reasonTrimmed) throw new Error("Informe o que aconteceu.");
  if (!(CAUSA_RAIZ_OPTIONS as readonly string[]).includes(opts.causaRaiz)) {
    throw new Error("Selecione quem errou.");
  }

  const admin = getSupabaseAdmin();
  const { data: parent, error: fetchError } = await admin
    .from("service_requests")
    .select(
      "ticket_number, status, type, store_id, exchange_round, client_name, client_phone, client_cpf, client_address, client_address_number, client_is_apartment, client_address_complement, client_neighborhood, client_protheus_code, order_code, invoice_number, seller_name, authorized_by, restriction_note, client_time_restriction, scheduled_date, scheduled_time, shift, rota, driver_name"
    )
    .eq("id", requestId)
    .single();
  if (fetchError || !parent) throw new Error("Solicitação não encontrada.");
  requireManageAccess(profile, parent.type);
  if (parent.type !== "troca_produto") throw new Error("Nova troca só se aplica a chamados de troca de produto.");
  if (parent.status !== "concluida") throw new Error("Só dá pra pedir uma nova troca depois que a troca anterior foi concluída.");

  let causaCarga: string | null = null;
  let causaConferente: string | null = null;
  let driverNameForError: string | null = null;
  let causaRaizDetalhe: string | null = null;
  if (opts.causaRaiz === "erro_conferencia") {
    causaCarga = (opts.causaCarga ?? "").trim();
    causaConferente = (opts.causaConferente ?? "").trim();
    if (!causaCarga) throw new Error("Informe a carga (erro de conferência precisa registrar qual foi).");
    if (!causaConferente) throw new Error("Informe o conferente (erro de conferência precisa registrar quem conferiu).");
  }
  if (opts.causaRaiz === "erro_motorista") {
    causaCarga = (opts.causaCarga ?? "").trim();
    const typedDriverName = (opts.driverNameForError ?? "").trim();
    if (!causaCarga) throw new Error("Informe a carga (erro do motorista precisa registrar qual foi).");
    if (!typedDriverName) throw new Error("Informe o motorista (erro do motorista precisa registrar quem entregou).");
    driverNameForError = await resolveDriverName(typedDriverName);
  }
  // "Outro" precisa dizer exatamente o que houve (pedido do Victor
  // 21/08/2026), mesmo padrão de erro_conferencia/erro_motorista acima --
  // só que sem sub-campos estruturados, um texto livre só.
  if (opts.causaRaiz === "outro") {
    causaRaizDetalhe = (opts.causaRaizDetalhe ?? "").trim();
    if (!causaRaizDetalhe) throw new Error("Descreva a causa raiz (obrigatório quando é \"Outro\").");
  }

  const nextRound = (parent.exchange_round ?? 1) + 1;
  const childId = randomUUID();

  const { data: items } = opts.sameProduct
    ? await admin.from("service_request_items").select("product, part_code, quantity, item_action").eq("request_id", requestId)
    : { data: [] as { product: string; part_code: string | null; quantity: number; item_action: string | null }[] };

  const { data: child, error } = await admin
    .from("service_requests")
    .insert({
      id: childId,
      type: "troca_produto",
      store_id: parent.store_id,
      requested_by: profile.id,
      // Responsável já entra quem criou -- pedido do Victor 19/08/2026:
      // "tem que ficar como responsável quem fez a solicitação, sempre".
      // Antes só virava responsável quem clicasse "assumir" depois (ver
      // claimRequest) -- sem isso a nova troca nascia "sem responsável"
      // mesmo tendo sido criada por alguém específico.
      assigned_to: profile.id,
      client_name: parent.client_name,
      client_phone: parent.client_phone,
      client_cpf: parent.client_cpf,
      client_address: parent.client_address,
      client_address_number: parent.client_address_number,
      client_is_apartment: parent.client_is_apartment,
      client_address_complement: parent.client_address_complement,
      client_neighborhood: parent.client_neighborhood,
      client_protheus_code: parent.client_protheus_code,
      order_code: parent.order_code,
      invoice_number: parent.invoice_number,
      seller_name: parent.seller_name,
      reason: reasonTrimmed,
      authorized_by: parent.authorized_by,
      restriction_note: parent.restriction_note,
      client_time_restriction: parent.client_time_restriction,
      driver_name: driverNameForError ?? parent.driver_name,
      scheduled_date: parent.scheduled_date,
      scheduled_time: parent.scheduled_time,
      shift: parent.shift,
      rota: parent.rota,
      causa_raiz: opts.causaRaiz,
      causa_carga: causaCarga,
      causa_conferente: causaConferente,
      causa_raiz_detalhe: causaRaizDetalhe,
      exchange_round: nextRound,
      parent_request_id: requestId,
      deadline_status: "aprovado",
    })
    .select("id, ticket_number")
    .single();
  if (error?.code === "23505") {
    throw new Error("Essa troca já tem uma nova rodada criada por outra pessoa. Recarregue a página.");
  }
  if (error || !child) throw new Error(`Não foi possível criar a nova troca: ${error?.message ?? "erro desconhecido"}`);

  if (items && items.length > 0) {
    const { error: itemsError } = await admin.from("service_request_items").insert(
      items.map((item) => ({
        request_id: childId,
        product: item.product,
        part_code: item.part_code,
        quantity: item.quantity,
        item_action: item.item_action,
      }))
    );
    if (itemsError) throw new Error(`Troca criada (#${child.ticket_number}), mas falhou ao copiar os itens: ${itemsError.message}`);
  }

  await admin.from("service_request_events").insert([
    {
      request_id: requestId,
      actor_id: profile.id,
      event_type: "note_added",
      note: `Gerou nova troca (${nextRound}ª rodada, chamado #${child.ticket_number}) -- produto trocado anteriormente apresentou problema: ${reasonTrimmed}`,
    },
    {
      request_id: childId,
      actor_id: profile.id,
      event_type: "created",
      to_status: "aberta",
      note: `${nextRound}ª troca, ligada ao chamado #${parent.ticket_number} -- ${reasonTrimmed}`,
    },
  ]);

  await notifyLoja(parent.store_id, {
    type: "status_changed",
    title: "Solicitação: nova troca necessária",
    message: reasonTrimmed,
    link: `/assistencia/${childId}`,
  });

  revalidatePath("/assistencia/fila");
  revalidatePath("/assistencia/sac");
  revalidatePath(`/assistencia/${requestId}`);

  return { id: child.id, ticketNumber: child.ticket_number };
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

// Pedido do Victor 21/08/2026: "quando alguem mandar imprimir essas
// notificações fique registrado em algum lugar quem imprimiu, data e
// hora". Mesmo padrão de addNote acima (insere em service_request_events),
// só que aceita vários ids de uma vez (impressão em lote, ver
// PrintButton.tsx/despacho-lote/page.tsx) e não precisa de nota nenhuma --
// actor_id + created_at já são o registro. Sem requireManageAccess de
// propósito: quem pode VER o despacho (ver canView nas duas páginas de
// despacho) pode imprimir -- editar é que é restrito por tipo, não
// ver/imprimir.
export async function logPrint(requestIds: string[]): Promise<void> {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin", "sac");
  const ids = requestIds.map((id) => id.trim()).filter(Boolean);
  if (ids.length === 0) return;

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("service_request_events").insert(
    ids.map((id) => ({
      request_id: id,
      actor_id: profile.id,
      event_type: "printed",
    }))
  );
  if (error) throw new Error(error.message);
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
  revalidatePath("/assistencia/agenda");
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

// Assistência organiza a própria fila na ordem que quiser (ex.: agrupar
// visualmente por bairro pra despachar montador) -- mesmo padrão de
// setDriverOrderAction (driver-actions.ts), só que sem checar "dono" (não
// existe: qualquer assistência/admin pode reorganizar qualquer chamado do
// domínio dela), e reordena só dentro do grupo mostrado na tela (ver
// AssistenciaQueueGroup.tsx). Cada update leva o assistencia_order que o
// cliente acreditava ser o atual como trava de corrida, igual às outras
// mutações desta sessão.
export async function setAssistenciaOrderAction(items: { id: string; expectedOrder: number | null }[]): Promise<void> {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin");
  if (items.length === 0) return;

  const admin = getSupabaseAdmin();
  const results = await Promise.all(
    items.map((item, index) => {
      const query = admin.from("service_requests").update({ assistencia_order: index + 1 }).eq("id", item.id);
      return (item.expectedOrder === null ? query.is("assistencia_order", null) : query.eq("assistencia_order", item.expectedOrder))
        .select("id")
        .maybeSingle();
    })
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);
  if (results.some((r) => !r.data)) {
    throw new Error("A ordem mudou em outra sessão. Recarregue a página e tente de novo.");
  }

  revalidatePath("/assistencia/fila");
  revalidatePath("/assistencia/agenda");
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
  // SAC também ajusta item dos próprios chamados de entrega desde
  // 17/08/2026 -- requireManageAccess abaixo já restringe por tipo.
  requireRole(profile, "assistencia", "admin", "sac");
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
  requireRole(profile, "assistencia", "admin", "sac");
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

// "Motorista do dia" -- pedido do Victor 17/08/2026: hoje o motorista era
// digitado chamado por chamado; isso marca de uma vez "hoje, rota X =
// Fulano" e reatribui quem ainda estiver no motorista padrão anterior (ou
// sem motorista nenhum). NÃO mexe em quem já foi movido manualmente pra
// outro carro (DriverNameField) -- isso é decisão deliberada de outra
// pessoa, uma troca de motorista da rota não desfaz. Chamados novos, daqui
// pra frente, puxam esse nome sozinhos ao serem agendados (ver setSchedule
// acima).
//
// Só existe UMA rota principal por dia (índice único parcial no banco, ver
// migration 0085) -- diferente de antes (17/08/2026, mesma tarde), quando
// dava pra editar praia/sul/centro como 3 slots independentes pro mesmo
// dia. Trocar a rota aqui SUBSTITUI a principal anterior (pode mudar de
// região, ex: era praia, passa a ser sul), nunca cria uma segunda linha
// principal -- pra um carro a mais no mesmo dia, ver addRotaExtra.
export async function setRotaDriverAssignment(
  date: string,
  rota: string,
  driverName: string
): Promise<{ updatedCount: number }> {
  const profile = await getProfile();
  // SAC também mexe no motorista do dia desde 17/08/2026 -- o painel agora
  // aparece na aba "Notificação de Assistência" do SAC também, não só na
  // fila da assistência. Sem restrição por tipo aqui de propósito: rota é
  // o carro físico do dia, carrega troca/entrega de produto (SAC) e envio
  // de peça (assistência) juntos -- quem redefine o motorista da rota
  // mexe no carro inteiro, os dois lados já esperam isso.
  requireRole(profile, "assistencia", "admin", "sac");
  if (!isRota(rota)) throw new Error("Rota inválida.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Data inválida.");
  const typedName = driverName.trim();
  if (!typedName) throw new Error("Informe o motorista.");

  const admin = getSupabaseAdmin();
  const name = await resolveDriverName(typedName);
  await admin.from("drivers").upsert({ name }, { onConflict: "name" });

  const { data: existingPrimary } = await admin
    .from("rota_driver_assignments")
    .select("id, driver_name")
    .eq("assignment_date", date)
    .eq("is_extra", false)
    .maybeSingle();
  const oldDriverName = existingPrimary?.driver_name as string | undefined;

  const { error: writeError } = existingPrimary
    ? await admin
        .from("rota_driver_assignments")
        .update({ rota, driver_name: name, updated_at: new Date().toISOString() })
        .eq("id", existingPrimary.id as string)
    : await admin.from("rota_driver_assignments").insert({ assignment_date: date, rota, driver_name: name, is_extra: false });
  if (writeError) throw new Error(writeError.message);

  let query = admin
    .from("service_requests")
    .update({ driver_name: name })
    .eq("rota", rota)
    .eq("scheduled_date", date)
    .not("status", "in", "(concluida,cancelada)");
  query = oldDriverName
    ? query.or(`driver_name.is.null,driver_name.eq.${sanitizeOrFilterValue(oldDriverName)}`)
    : query.is("driver_name", null);
  const { data: updated, error: updateError } = await query.select("id");
  if (updateError) throw new Error(updateError.message);

  revalidatePath("/assistencia/fila");
  revalidatePath("/assistencia/sac");
  return { updatedCount: updated?.length ?? 0 };
}

// Carro(s) a mais saindo no mesmo dia, além da rota principal -- pedido do
// Victor 17/08/2026 ("só uma rota por dia, mas pode ter rota extra").
// Diferente da principal, não tem limite de quantidade nem some ao trocar
// outra rota extra -- cada uma é uma linha própria (ver removeRotaExtra
// pra tirar).
export async function addRotaExtra(date: string, rota: string, driverName: string): Promise<{ updatedCount: number }> {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin", "sac");
  if (!isRota(rota)) throw new Error("Rota inválida.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Data inválida.");
  const typedName = driverName.trim();
  if (!typedName) throw new Error("Informe o motorista.");

  const admin = getSupabaseAdmin();
  const name = await resolveDriverName(typedName);
  await admin.from("drivers").upsert({ name }, { onConflict: "name" });

  const { error: insertError } = await admin
    .from("rota_driver_assignments")
    .insert({ assignment_date: date, rota, driver_name: name, is_extra: true });
  if (insertError) throw new Error(insertError.message);

  // Só pega chamado ainda sem motorista -- rota extra nunca "rouba" quem já
  // tinha sido atribuído pela principal ou por outra extra.
  const { data: updated, error: updateError } = await admin
    .from("service_requests")
    .update({ driver_name: name })
    .eq("rota", rota)
    .eq("scheduled_date", date)
    .is("driver_name", null)
    .not("status", "in", "(concluida,cancelada)")
    .select("id");
  if (updateError) throw new Error(updateError.message);

  revalidatePath("/assistencia/fila");
  revalidatePath("/assistencia/sac");
  return { updatedCount: updated?.length ?? 0 };
}

export async function removeRotaExtra(id: string): Promise<void> {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin", "sac");
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("rota_driver_assignments").delete().eq("id", id).eq("is_extra", true);
  if (error) throw new Error(error.message);
  revalidatePath("/assistencia/fila");
  revalidatePath("/assistencia/sac");
}

// Wrapper "use server" pro widget RotaMotoristaDoDia buscar de novo ao trocar
// de data -- getRotaDriverAssignments (rotas.ts) é só leitura, sem
// "use server", não dá pra chamar direto de um componente client.
export async function getRotaDriverAssignmentsAction(date: string) {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin", "sac");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Data inválida.");
  return getRotaDriverAssignments(date);
}

// Wrapper "use server" pro ScheduleField/SacCreateRequestForm buscarem as
// rotas disponíveis pra uma data assim que ela é escolhida -- pedido do
// Victor 18/08/2026: a escolha de rota tem que vir de dentro das disponíveis
// pra aquele dia, não mais livre com aviso de exceção depois (ver
// getAvailableRotasForDate em rotas.ts).
export async function getAvailableRotasForDateAction(date: string): Promise<AvailableRota[]> {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin", "sac");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  return getAvailableRotasForDate(date);
}

export async function setSchedule(
  requestId: string,
  scheduledDate: string,
  shift: string,
  scheduledTime: string,
  rota?: string,
  // Motorista explícito da atribuição escolhida (ver ScheduleField.tsx) --
  // pedido do Victor 21/08/2026: precisa pra diferenciar duas atribuições
  // com a MESMA rota (principal + extra) e motoristas diferentes, já que
  // só a rota sozinha não identifica qual delas foi escolhida. Sem isso,
  // cai no primeiro match por rota (comportamento de sempre).
  driverName?: string
) {
  const profile = await getProfile();
  // SAC também agenda rota/data dos próprios chamados (troca/entrega de
  // produto) desde 17/08/2026 -- antes só assistência/admin passavam daqui,
  // mesmo o SAC já gerenciando esses tipos em todo o resto da tela
  // (DeliveryRequestDetailContent mostrava o campo editável, mas salvar
  // sempre falhava com "ação não permitida"). requireManageAccess logo
  // abaixo já restringe por tipo (SAC só mexe no que SAC_MANAGED_TYPES
  // cobre -- envio de peça continua exclusivo da assistência), então abrir
  // aqui não dá acesso a mais do que o SAC já tinha em outros campos.
  requireRole(profile, "assistencia", "admin", "sac");
  if (shift && !SHIFTS.includes(shift as (typeof SHIFTS)[number])) {
    throw new Error("Turno inválido.");
  }

  const admin = getSupabaseAdmin();
  const { data: current } = await admin
    .from("service_requests")
    .select("type, status, scheduled_date, rota, driver_name")
    .eq("id", requestId)
    .single();
  if (!current) throw new Error("Solicitação não encontrada.");
  requireManageAccess(profile, current.type);

  // "Remarcar" significa "precisa de uma data nova" -- assim que a
  // assistência define essa data nova, o selo tem que sumir (voltar pro
  // fluxo normal de em andamento), senão fica preso mostrando "Remarcar"
  // pra sempre mesmo depois de já remarcado de verdade.
  const clearingRemarcar = current.status === "remarcar" && !!scheduledDate;

  // Rota (praia/sul/centro) é só pra quem sai de motorista -- montagem,
  // desmontagem, vistoria e troca de peça são visita de montador e não têm
  // rota, mesmo tendo data agendada. Ignora silenciosamente em vez de
  // travar: a UI já esconde o campo pra esses tipos (ver ScheduleField),
  // isso aqui é só a segunda trava, pra nunca gravar rota fora do lugar
  // mesmo se algo chamar essa action diretamente.
  const isDeliveryType = (DELIVERY_REQUEST_TYPES as readonly string[]).includes(current.type);
  const rotaInput = isDeliveryType ? rota : undefined;

  let rotaValue: string | null = null;
  // Motorista não é mais um campo à parte da solicitação (pedido do Victor
  // 18/08/2026: "a rota e o motorista são ligados um ao outro") -- vem
  // sempre junto da rota escolhida (ver getAvailableRotasForDate), null se
  // aquela rota/data ainda não tem motorista definido no painel "Motorista
  // do dia". Só muda de verdade lá, nunca digitando aqui.
  let driverNameForRota: string | null = null;
  if (scheduledDate && rotaInput) {
    if (!isRota(rotaInput)) throw new Error("Rota inválida.");
    const availableRotas = await getAvailableRotasForDate(scheduledDate);
    // Mantém a rota que o chamado já tinha pra essa mesma data mesmo se ela
    // não estiver mais na lista de disponíveis (achado 18/08/2026: sem essa
    // exceção, salvar qualquer outro campo -- turno, hora -- de um chamado
    // com rota "fora do padrão" apagava a rota sozinho, sem o usuário nem
    // ter mexido nela).
    const isCurrentAssignment = scheduledDate === current.scheduled_date && rotaInput === current.rota;
    // Match por rota+motorista quando o motorista veio explícito (ver
    // parâmetro driverName acima) -- é isso que escolhe a atribuição certa
    // quando duas têm a mesma rota (principal + extra). Sem motorista
    // informado, cai no primeiro match por rota só (chamadas antigas/
    // diretas que ainda não passam o parâmetro novo).
    const match = driverName
      ? availableRotas.find((r) => r.rota === rotaInput && r.driverName === driverName)
      : availableRotas.find((r) => r.rota === rotaInput);
    if (!match && !isCurrentAssignment) {
      throw new Error(`${ROTA_LABELS[rotaInput]} não tem carro saindo em ${scheduledDate.split("-").reverse().join("/")} — escolha uma das rotas disponíveis pra essa data.`);
    }
    rotaValue = rotaInput;
    driverNameForRota = match?.driverName ?? (isCurrentAssignment ? current.driver_name : null);
  }
  // Não escreve mais nota de exceção -- a escolha já vem restrita às rotas
  // disponíveis pra data (ver acima), então não existe mais "fora da rota"
  // pra justificar. Uma nota antiga (de antes dessa mudança) "gruda" até o
  // chamado ser reagendado de novo; aqui ela é sempre limpa.
  const exceptionNote: string | null = null;

  const { error } = await admin
    .from("service_requests")
    .update({
      scheduled_date: scheduledDate || null,
      shift: shift || null,
      scheduled_time: scheduledTime || null,
      rota: rotaValue,
      rota_exception_note: exceptionNote,
      // Só toca no motorista pra tipo de entrega -- montagem/desmontagem/
      // vistoria/troca de peça usam montador, não motorista (ver
      // isDeliveryType acima), e nunca deviam ter essa coluna mexida aqui.
      ...(isDeliveryType ? { driver_name: driverNameForRota } : {}),
      ...(clearingRemarcar ? { status: "em_andamento" } : {}),
    })
    .eq("id", requestId);
  if (error) throw new Error(error.message);

  const shiftLabel = SHIFT_LABELS[shift] ?? shift;
  const rotaNote = rotaValue ? ` · rota ${ROTA_LABELS[rotaValue as keyof typeof ROTA_LABELS]}` : "";
  await admin.from("service_request_events").insert({
    request_id: requestId,
    actor_id: profile.id,
    event_type: clearingRemarcar ? "status_changed" : "note_added",
    from_status: clearingRemarcar ? "remarcar" : undefined,
    to_status: clearingRemarcar ? "em_andamento" : undefined,
    note: scheduledDate
      ? `Visita agendada: ${scheduledDate}${scheduledTime ? ` às ${scheduledTime}` : ""}${shift ? ` (${shiftLabel})` : ""}${rotaNote}`
      : "Agendamento removido.",
  });

  revalidatePath("/assistencia/fila");
  revalidatePath("/assistencia/agenda");
  revalidatePath(`/assistencia/${requestId}`);
}

// Colocar várias notificações na mesma rota de uma vez (pedido do Victor
// 19/08/2026: "preciso selecionar em bloco pra colocar todas em uma rota")
// -- reaproveita setSchedule pra cada id, mesma validação/log de evento/
// revalidate de sempre, só preservando o turno/hora que cada chamado já
// tinha (bulk é só sobre rota+data, não deve apagar o resto). Não falha
// tudo se um item der erro -- devolve quantos deram certo + a lista de
// erros pra UI mostrar o que precisa de atenção manual.
export async function bulkSetRotaAction(
  requestIds: string[],
  scheduledDate: string,
  rota: string,
  // Motorista explícito da atribuição escolhida (ver BulkRotaBar em
  // NotificacoesList.tsx) -- mesmo motivo de setSchedule: sem isso, duas
  // atribuições com a mesma rota (principal + extra) ficam ambíguas.
  driverName?: string
): Promise<{ successCount: number; errors: string[] }> {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin", "sac");
  if (requestIds.length === 0) throw new Error("Selecione pelo menos uma solicitação.");
  if (!scheduledDate) throw new Error("Escolha uma data.");
  if (!isRota(rota)) throw new Error("Rota inválida.");

  const admin = getSupabaseAdmin();
  const { data: rows, error } = await admin
    .from("service_requests")
    .select("id, ticket_number, shift, scheduled_time")
    .in("id", requestIds);
  if (error) throw new Error(error.message);

  const errors: string[] = [];
  let successCount = 0;
  for (const row of rows ?? []) {
    try {
      await setSchedule(row.id, scheduledDate, row.shift ?? "", row.scheduled_time ?? "", rota, driverName);
      successCount++;
    } catch (e) {
      errors.push(`#${row.ticket_number}: ${e instanceof Error ? e.message : "erro desconhecido"}`);
    }
  }
  return { successCount, errors };
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
  // CPF obrigatório em toda solicitação (pedido do Victor 19/08/2026).
  const clientCpf = String(formData.get("client_cpf") ?? "").trim();
  if (!clientCpf) return { error: "Informe o CPF do cliente." };
  const storeId = String(formData.get("store_id") ?? "").trim();
  if (!storeId) return { error: "Selecione a loja." };

  const admin = getSupabaseAdmin();
  const { data: currentRequest } = await admin.from("service_requests").select("type, assembler_name").eq("id", requestId).single();
  if (!currentRequest) return { error: "Solicitação não encontrada." };
  requireManageAccess(profile, currentRequest.type);

  // Corrigir o tipo (ex: alguém abriu como "montagem" mas era "troca de
  // peça") -- restrito ao mesmo domínio que o papel já gerencia (ver
  // manageableTypesForRole/requireManageAccess): sem essa 2ª checagem, dava
  // pra mover um chamado pra um tipo que o próprio papel que editou não
  // consegue mais enxergar/gerenciar depois.
  const type = String(formData.get("type") ?? currentRequest.type).trim();
  if (!(ALL_REQUEST_TYPES as readonly string[]).includes(type)) {
    return { error: "Tipo de solicitação inválido." };
  }
  const typeChanged = type !== currentRequest.type;
  if (typeChanged) requireManageAccess(profile, type);

  // Vistoria/troca de peça exigem o Manoel (ver MANOEL_ONLY_TYPES) -- se o
  // chamado tinha outro montador definido e o tipo virou um desses, esse
  // montador some da lista de destino, então a atribuição atual viraria
  // inválida silenciosamente. Mais seguro limpar e deixar quem editou
  // reatribuir do que manter um estado que os pagamentos não reconhecem.
  const assemblerNowInvalid =
    typeChanged &&
    (MANOEL_ONLY_TYPES as readonly string[]).includes(type) &&
    !!currentRequest.assembler_name &&
    currentRequest.assembler_name !== MANOEL_ONLY_ASSEMBLER;

  const addressNumberFields = readAddressNumberFields(formData, type);
  if (addressNumberFields.error) return { error: addressNumberFields.error };

  const { error } = await admin
    .from("service_requests")
    .update({
      type,
      ...(assemblerNowInvalid ? { assembler_name: null } : {}),
      store_id: storeId,
      order_code: emptyToNull(formData.get("order_code")),
      client_name: clientName,
      client_cpf: clientCpf,
      client_phone: emptyToNull(formData.get("client_phone")),
      client_address: emptyToNull(formData.get("client_address")),
      client_address_number: emptyToNull(addressNumberFields.number),
      client_is_apartment: addressNumberFields.isApartment,
      client_address_complement: emptyToNull(addressNumberFields.complement),
      client_neighborhood: emptyToNull(formData.get("client_neighborhood")),
      reason: emptyToNull(formData.get("reason")),
      authorized_by: emptyToNull(formData.get("authorized_by")),
      montador_instruction: emptyToNull(formData.get("montador_instruction")),
      restriction_note: emptyToNull(formData.get("restriction_note")),
      client_time_restriction: emptyToNull(formData.get("client_time_restriction")),
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
    note: typeChanged
      ? `Tipo alterado: ${REQUEST_TYPE_LABELS[currentRequest.type] ?? currentRequest.type} → ${REQUEST_TYPE_LABELS[type] ?? type}.`
      : "Dados da solicitação corrigidos.",
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
  const admin = getSupabaseAdmin();

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

  const clientProtheusCode = String(formData.get("client_protheus_code") ?? "").trim();
  if (!clientProtheusCode) return { error: "Informe o código do cliente." };

  // CPF obrigatório em toda solicitação (pedido do Victor 19/08/2026) --
  // identifica o cliente de verdade, independente de ter código do
  // Protheus certo ou não.
  const clientCpf = String(formData.get("client_cpf") ?? "").trim();
  if (!clientCpf) return { error: "Informe o CPF do cliente." };

  const clientPhone = String(formData.get("client_phone") ?? "").trim();
  if (!clientPhone) return { error: "Informe o telefone." };

  const clientAddress = String(formData.get("client_address") ?? "").trim();
  if (!clientAddress) return { error: "Informe o endereço." };

  const clientNeighborhood = String(formData.get("client_neighborhood") ?? "").trim();
  if (!clientNeighborhood) return { error: "Informe o bairro." };

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

  // Recolhimento de peça é o único tipo de entrega (usa motorista/rota, não
  // montador) que passa por essa action -- os outros 3 (troca/entrega de
  // produto, envio de peça) só nascem via createSacRequest. Mesma validação
  // de lá: "Autorizado por" e "Quem errou" obrigatórios, rota restrita às
  // disponíveis pra data escolhida (pedido do Victor 18/08/2026: "revise e
  // veja se ficou igual ao do sac pra essa modalidade").
  const isDelivery = (DELIVERY_REQUEST_TYPES as readonly string[]).includes(type);
  const authorizedBy = String(formData.get("authorized_by") ?? "").trim();
  if (isDelivery && !authorizedBy) return { error: "Informe quem autorizou." };

  let causaRaiz: string | null = null;
  let causaCarga: string | null = null;
  let causaConferente: string | null = null;
  let driverNameForError: string | null = null;
  let causaRaizDetalhe: string | null = null;
  if (isDelivery) {
    causaRaiz = String(formData.get("causa_raiz") ?? "").trim();
    if (!(CAUSA_RAIZ_OPTIONS as readonly string[]).includes(causaRaiz)) {
      return { error: "Selecione quem errou." };
    }
    if (causaRaiz === "erro_conferencia") {
      causaCarga = String(formData.get("causa_carga") ?? "").trim();
      causaConferente = String(formData.get("causa_conferente") ?? "").trim();
      if (!causaCarga) return { error: "Informe a carga (erro de conferência precisa registrar qual foi)." };
      if (!causaConferente) return { error: "Informe o conferente (erro de conferência precisa registrar quem conferiu)." };
    }
    if (causaRaiz === "erro_motorista") {
      causaCarga = String(formData.get("causa_carga") ?? "").trim();
      const typedDriverName = String(formData.get("driver_name") ?? "").trim();
      if (!causaCarga) return { error: "Informe a carga (erro do motorista precisa registrar qual foi)." };
      if (!typedDriverName) return { error: "Informe o motorista (erro do motorista precisa registrar quem entregou)." };
      driverNameForError = await resolveDriverName(typedDriverName);
    }
    // "Outro" precisa dizer exatamente o que houve (pedido do Victor
    // 21/08/2026), mesmo padrão de erro_conferencia/erro_motorista acima.
    if (causaRaiz === "outro") {
      causaRaizDetalhe = String(formData.get("causa_raiz_detalhe") ?? "").trim();
      if (!causaRaizDetalhe) return { error: "Descreva a causa raiz (obrigatório quando é \"Outro\")." };
    }
  }

  const scheduledDateInput = String(formData.get("scheduled_date") ?? "").trim();
  const rotaInput = String(formData.get("rota") ?? "").trim();
  let rotaValue: string | null = null;
  let driverNameForRota: string | null = null;
  if (isDelivery && scheduledDateInput && rotaInput) {
    if (!isRota(rotaInput)) return { error: "Rota inválida." };
    const availableRotas = await getAvailableRotasForDate(scheduledDateInput);
    const match = availableRotas.find((r) => r.rota === rotaInput);
    if (!match) {
      return {
        error: `${ROTA_LABELS[rotaInput]} não tem carro saindo em ${scheduledDateInput.split("-").reverse().join("/")} — escolha uma das rotas disponíveis pra essa data.`,
      };
    }
    rotaValue = rotaInput;
    driverNameForRota = match.driverName;
  }
  if (driverNameForRota) {
    await admin.from("drivers").upsert({ name: driverNameForRota }, { onConflict: "name" });
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

  // Pedido do Victor 15/08/2026: código do produto passa a ser obrigatório
  // pra montagem/desmontagem -- antes era só uma sugestão pra autopreencher
  // o nome (ver hint em QuickCreateRequestForm.tsx).
  if (type === "montagem" || type === "desmontagem") {
    const semCodigo = items.find((item) => !item.partCode);
    if (semCodigo) return { error: `Informe o código do produto "${semCodigo.product}".` };
  }

  if (assemblerName) {
    await admin.from("assemblers").upsert({ name: assemblerName }, { onConflict: "name" });
  }

  const { data, error } = await admin
    .from("service_requests")
    .insert({
      type,
      store_id: storeId,
      requested_by: profile.id,
      // Responsável já entra quem criou (pedido do Victor 19/08/2026: "tem
      // que ficar como responsável quem fez a solicitação, sempre").
      assigned_to: profile.id,
      client_name: clientName,
      client_cpf: clientCpf,
      client_phone: clientPhone,
      client_address: clientAddress,
      client_neighborhood: clientNeighborhood,
      client_address_number: emptyToNull(addressNumberFields.number),
      client_is_apartment: addressNumberFields.isApartment,
      client_address_complement: emptyToNull(addressNumberFields.complement),
      client_protheus_code: emptyToNull(clientProtheusCode),
      reason: reason,
      authorized_by: emptyToNull(authorizedBy),
      driver_name: driverNameForError ?? driverNameForRota,
      rota: rotaValue,
      causa_raiz: causaRaiz,
      causa_carga: causaCarga,
      causa_conferente: causaConferente,
      causa_raiz_detalhe: causaRaizDetalhe,
      montador_instruction: emptyToNull(formData.get("montador_instruction")),
      // Restrição de horário/turno do cliente pra receber (pedido do Victor
      // 19/08/2026) -- só faz sentido pra tipo de entrega, mas não custa
      // salvar o texto se vier preenchido de qualquer forma.
      client_time_restriction: isDelivery ? emptyToNull(formData.get("client_time_restriction")) : null,
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
  // Volta a cair no detalhe (não no despacho) -- redirecionar direto pra
  // impressão na criação foi revertido 17/08/2026: a solicitação em si já é
  // o registro, "Imprimir despacho" fica disponível no chamado sempre que
  // precisar de verdade, não precisa ser forçado no momento de salvar.
  redirect(`/assistencia/${data.id}`);
}

const SAC_REQUEST_TYPES = [
  "troca_produto",
  "entrega_produto",
  "envio_peca",
  "recolhimento_produto",
  "notificacao_externa",
  "montagem",
  "desmontagem",
] as const;

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

  const clientProtheusCode = String(formData.get("client_protheus_code") ?? "").trim();
  // CPF obrigatório em toda solicitação (pedido do Victor 19/08/2026) --
  // código do cliente continua opcional (só serve pra autopreencher o
  // resto), CPF é que identifica o cliente de verdade.
  const clientCpf = String(formData.get("client_cpf") ?? "").trim();
  if (!clientCpf) return { error: "Informe o CPF do cliente." };

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

  // Quem autorizou a troca/entrega/envio -- campo livre, não é quem está
  // preenchendo o formulário (pedido do Victor 18/08/2026: antes o
  // despacho impresso mostrava o nome de quem criou o chamado no sistema
  // como se fosse quem autorizou, o que quase nunca é a mesma pessoa).
  const isDeliveryTypeCreate = (DELIVERY_REQUEST_TYPES as readonly string[]).includes(type);
  const authorizedBy = String(formData.get("authorized_by") ?? "").trim();
  if (isDeliveryTypeCreate && !authorizedBy) return { error: "Informe quem autorizou." };

  const driverNameInput = emptyToNull(formData.get("driver_name"));

  // Causa raiz ("quem errou") passou a ser obrigatória pra todo tipo de
  // entrega (pedido do Victor 18/08/2026), não só troca_produto -- só os
  // campos extras de erro_conferencia/erro_motorista (carga, conferente)
  // continuam exclusivos de troca_produto, que é o único com recolhimento
  // de verdade. Erro de conferência e erro do motorista eram uma causa só
  // ("erro_cd") até 14/08/2026 -- separadas por pedido do usuário, pra dar
  // pra metrificar as duas coisas de forma independente (ver
  // 0080_causa_raiz_conferencia_motorista.sql).
  let causaRaiz: string | null = null;
  let causaCarga: string | null = null;
  let causaConferente: string | null = null;
  let causaRaizDetalhe: string | null = null;
  if (isDeliveryTypeCreate) {
    causaRaiz = String(formData.get("causa_raiz") ?? "").trim();
    if (!(CAUSA_RAIZ_OPTIONS as readonly string[]).includes(causaRaiz)) {
      return { error: "Selecione quem errou." };
    }
    if (type === "troca_produto" && causaRaiz === "erro_conferencia") {
      causaCarga = String(formData.get("causa_carga") ?? "").trim();
      causaConferente = String(formData.get("causa_conferente") ?? "").trim();
      if (!causaCarga) return { error: "Informe a carga (erro de conferência precisa registrar qual foi)." };
      if (!causaConferente) return { error: "Informe o conferente (erro de conferência precisa registrar quem conferiu)." };
    }
    if (causaRaiz === "erro_motorista") {
      causaCarga = String(formData.get("causa_carga") ?? "").trim();
      if (!causaCarga) return { error: "Informe a carga (erro do motorista precisa registrar qual foi)." };
      if (!driverNameInput) return { error: "Informe o motorista (erro do motorista precisa registrar quem entregou)." };
    }
    // "Outro" precisa dizer exatamente o que houve (pedido do Victor
    // 21/08/2026: "quando... selecionar 'outro' ele precisar digitar o
    // que houve exatamente"), mesmo padrão de erro_conferencia/
    // erro_motorista acima -- só que sem sub-campos estruturados.
    if (causaRaiz === "outro") {
      causaRaizDetalhe = String(formData.get("causa_raiz_detalhe") ?? "").trim();
      if (!causaRaizDetalhe) return { error: "Descreva a causa raiz (obrigatório quando é \"Outro\")." };
    }
  }

  const scheduledDate = String(formData.get("scheduled_date") ?? "").trim();
  const scheduledTime = String(formData.get("scheduled_time") ?? "").trim();
  const rotaInput = String(formData.get("rota") ?? "").trim();

  // Mesma validação de setSchedule (edição do chamado já criado) -- rota só
  // pode ser uma das disponíveis pra data escolhida (pedido do Victor
  // 18/08/2026), sem mais encaixe livre com justificativa. Motorista vem
  // junto da rota escolhida (mesmo pedido: "a rota e o motorista são
  // ligados um ao outro") -- null se aquela rota/data ainda não tem
  // motorista definido no painel "Motorista do dia".
  let rotaValue: string | null = null;
  let driverNameForRota: string | null = null;
  if (scheduledDate && rotaInput) {
    if (!isRota(rotaInput)) return { error: "Rota inválida." };
    const availableRotas = await getAvailableRotasForDate(scheduledDate);
    const match = availableRotas.find((r) => r.rota === rotaInput);
    if (!match) {
      return { error: `${ROTA_LABELS[rotaInput]} não tem carro saindo em ${scheduledDate.split("-").reverse().join("/")} — escolha uma das rotas disponíveis pra essa data.` };
    }
    rotaValue = rotaInput;
    driverNameForRota = match.driverName;
  }
  const rotaExceptionNote: string | null = null;

  const urgent = formData.get("urgent") === "on";
  // Vale pra montagem e desmontagem (pedido do Victor 18/08/2026: "SAC
  // também faz desmontagem", antes só existia como perna do combo de
  // montagem) -- mesma ideia de createQuickRequest, pedir a ação oposta na
  // mesma visita sem abrir um segundo chamado.
  const isVisitaType = type === "montagem" || type === "desmontagem";
  const comboMontagemDesmontagem = isVisitaType && formData.get("combo_montagem_desmontagem") === "on";

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

  // "item" é a lista principal (produto a entregar, ou a montar/desmontar
  // quando o type é montagem/desmontagem); "item_secondary" só existe com o
  // combo marcado, e é sempre a ação oposta à do type principal. Fora do
  // combo, o próprio type já diz o que fazer com cada item -- sem tag por
  // item (mesmo padrão de createQuickRequest).
  const primaryAction: "montar" | "desmontar" | null = comboMontagemDesmontagem ? (type === "montagem" ? "montar" : "desmontar") : null;
  const secondaryAction: "montar" | "desmontar" = primaryAction === "montar" ? "desmontar" : "montar";
  const primaryItems = parseItems("item").map((item) => ({ ...item, action: primaryAction }));
  const secondaryItems = comboMontagemDesmontagem
    ? parseItems("item_secondary").map((item) => ({ ...item, action: secondaryAction }))
    : [];
  if (comboMontagemDesmontagem && secondaryItems.length === 0) {
    return {
      error: `Informe pelo menos um móvel pra ${secondaryAction === "montar" ? "montar" : "desmontar"} (a outra ação da visita combo).`,
    };
  }
  const items = [...primaryItems, ...secondaryItems];

  // Pedido do Victor 15/08/2026: código do produto passa a ser obrigatório
  // pra montagem/desmontagem (e pro móvel da ação oposta, no combo) -- antes
  // era só uma sugestão pra autopreencher o nome (ver hint em
  // SacNovaVisitaForm.tsx).
  if (isVisitaType) {
    const semCodigo = items.find((item) => !item.partCode);
    if (semCodigo) return { error: `Informe o código do produto "${semCodigo.product}".` };
  }

  const admin = getSupabaseAdmin();
  // Motorista não é mais um campo livre na criação (pedido do Victor
  // 18/08/2026) -- só continua digitável pra "erro do motorista" (precisa
  // registrar explicitamente quem entregou o item com defeito). Fora esse
  // caso, vem sempre da rota escolhida (ver acima).
  const driverName = driverNameInput ? await resolveDriverName(driverNameInput) : driverNameForRota;
  if (driverName) {
    await admin.from("drivers").upsert({ name: driverName }, { onConflict: "name" });
  }

  // Sem anexo aqui -- pedido do Victor 17/08/2026: só o motorista precisa
  // tirar foto (o comprovante assinado, obrigatório pra concluir a rota,
  // ver driverCompleteRequest). A solicitação em si já vira o despacho pra
  // imprimir, não precisa de nada anexado na hora de criar.
  const requestId = randomUUID();

  const { data, error } = await admin
    .from("service_requests")
    .insert({
      id: requestId,
      type,
      store_id: storeId,
      requested_by: profile.id,
      // Responsável já entra quem criou (pedido do Victor 19/08/2026: "tem
      // que ficar como responsável quem fez a solicitação, sempre").
      assigned_to: profile.id,
      client_name: clientName,
      client_phone: clientPhone,
      client_address: clientAddress,
      client_address_number: emptyToNull(addressNumberFields.number),
      client_is_apartment: addressNumberFields.isApartment,
      client_address_complement: emptyToNull(addressNumberFields.complement),
      client_neighborhood: clientNeighborhood,
      client_protheus_code: emptyToNull(clientProtheusCode),
      client_cpf: emptyToNull(clientCpf),
      reason: reason,
      authorized_by: emptyToNull(authorizedBy),
      restriction_note: emptyToNull(formData.get("restriction_note")),
      // Restrição de horário/turno do cliente pra receber (pedido do Victor
      // 19/08/2026: "só pode receber de manhã ou só a tarde e só recebe das
      // 14h as 17h, algo assim") -- só faz sentido pra tipo de entrega.
      client_time_restriction: isDeliveryTypeCreate ? emptyToNull(formData.get("client_time_restriction")) : null,
      driver_name: driverName,
      scheduled_date: scheduledDate || null,
      scheduled_time: scheduledTime || null,
      rota: rotaValue,
      rota_exception_note: rotaExceptionNote,
      shift: urgent ? "urgencia" : null,
      sac_category: type === "notificacao_externa" ? emptyToNull(formData.get("sac_category")) : null,
      causa_raiz: causaRaiz,
      causa_carga: causaCarga,
      causa_conferente: causaConferente,
      causa_raiz_detalhe: causaRaizDetalhe,
      combo_montagem_desmontagem: comboMontagemDesmontagem,
      // Criado direto pelo SAC, não pela loja — não há prazo pra aprovar.
      deadline_status: "aprovado",
    })
    .select("id, ticket_number")
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
