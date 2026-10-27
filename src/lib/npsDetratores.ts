import { getSupabaseAdmin } from "./supabaseAdmin";
import { sendGhlMessage, type GhlConta } from "./ghlClient";

// Lista de trabalho unificada de detratores -- pedido do Victor 08/09/2026:
// nome/contato/motivo de todo mundo que deu nota baixa em QUALQUER NPS que
// o sistema roda, não só o do SAC. Todas as 5 pesquisas usam a MESMA
// escala 1-5 desde 22/09/2026 (pedido do Victor: "eu prefiro como funciona
// hoje a avaliação do sac") -- promotor 4-5, neutro 3, detrator 1-2, mesmo
// critério de buildNpsSummary (kpi.ts, SAC) e NPS_1_5_PATTERN abaixo.
// Antes disso montagem/assistência técnica/entrega/compra usavam 0-10 (NPS
// clássico de mercado) -- revertido pra ficar consistente com o mecanismo
// do SAC (WhatsApp List Message, resposta = "N - Label" ecoada de volta),
// não um número livre digitado.
// "venda" (Pós-venda, atendimento em loja) adicionada em 19/10/2026 -- ver
// vendaNps.ts.
export const NPS_DETRATOR_ORIGENS = ["sac", "montagem", "assistencia_tecnica", "entrega", "compra", "venda"] as const;
export type NpsDetratorOrigem = (typeof NPS_DETRATOR_ORIGENS)[number];

export const NPS_DETRATOR_ORIGEM_LABELS: Record<NpsDetratorOrigem, string> = {
  sac: "Atendimento (SAC)",
  montagem: "Pós-montagem",
  assistencia_tecnica: "Pós-assistência técnica",
  entrega: "Pós-entrega",
  compra: "20 dias pós-recebimento",
  venda: "Pós-venda (atendimento em loja)",
};

// Tag do GHL que dispara o Workflow de cada pesquisa -- pedido do Victor
// 22/09/2026. Cada Workflow (criado direto no GHL, fora daqui) já tem
// "Contact Tag" (filtro "Tag added") como trigger + o template de WhatsApp
// como ação seguinte -- aplicar a tag (addContactTag, ghlClient.ts) é o
// suficiente pra disparar o envio. "sac" fica de fora -- aquele NPS usa
// outro mecanismo (nps_score direto na conversa do GHL, sem Workflow de
// tag nenhum por trás).
export const NPS_GHL_TAG: Partial<Record<NpsDetratorOrigem, string>> = {
  montagem: "gatilho-nps-montagem",
  assistencia_tecnica: "gatilho-nps-assistencia",
  entrega: "gatilho-nps-entrega",
  compra: "gatilho-nps-compra",
  // "nps-atendimento-loja", não "gatilho-nps-*" como os outros 4 -- o
  // Workflow "NPS Atendimento Loja" já foi criado no GHL (19/10/2026) com
  // esse nome de tag no trigger "Contact Tag"; o código precisa bater
  // exatamente com o que já existe lá, não o padrão de nomenclatura dos
  // outros.
  venda: "nps-atendimento-loja",
};

// Padrão de resposta via WhatsApp List Message -- mesmo mecanismo do NPS
// do SAC (detectNpsScore, api/sync/route.ts), reaproveitado desde
// 22/09/2026 pelas 4 pesquisas adicionais: o cliente toca numa das 5
// opções da lista e o WhatsApp ecoa de volta o texto exato dela ("5 -
// Muito satisfeito" etc.), nunca um número livre digitado à mão. Uma só
// definição aqui em vez de copiada em cada arquivo (api/sync/route.ts,
// nps2Meses.ts, entregaNps.ts) -- evita as 3 cópias divergirem um dia.
export const NPS_1_5_PATTERN = /^([1-5])\s*-\s*(muito insatisfeito|insatisfeito|indiferente|satisfeito|muito satisfeito)\s*$/i;

// Resposta automática pós-nota -- achado do Pedro 24/10/2026 (loja de
// Tambaú, cliente "Charles"): o cliente respondia a pesquisa e a conversa
// ficava parada, sem retorno nenhum -- ninguém via que tinha chegado
// resposta. "nota boa - agradecer, nota baixa - tentar entender o motivo"
// (pedido do Pedro). Restrito por enquanto a quem já roda pela subconta
// Lojas Maia -- venda/compra (decisão do Victor 24/10/2026, não pra
// montagem/assistência técnica/SAC); "entrega" fica de fora por já ter o
// próprio "obrigado" + pedido de avaliação Google (ver entregaNps.ts/
// googleReviewRequest.ts), não precisa desse aqui. Mesmo corte de
// promotor/detrator de npsFromScores (getNpsResumoPorFaseAdicional abaixo)
// -- "nota baixa" aqui inclui o neutro (3) de propósito, tentar entender o
// motivo também faz sentido pra quem ficou "indiferente". Best-effort
// (nunca lança) -- mesmo padrão de maybeRequestGoogleReview: um problema
// aqui não pode derrubar a detecção da nota, que já foi gravada antes de
// chamar isso.
export async function sendNpsAutoReply(ghlContactId: string, score: number, conta?: GhlConta): Promise<void> {
  const message =
    score >= 4
      ? "Muito obrigado pela sua avaliação! 🙏 Ficamos felizes que você teve uma boa experiência com a gente. Contamos com você sempre!"
      : "Poxa, sentimos muito que sua experiência não tenha sido tão boa. Pode nos contar o que aconteceu? Isso nos ajuda a melhorar de verdade. 🙏";
  try {
    await sendGhlMessage(ghlContactId, message, conta);
  } catch {
    // best-effort, ver comentário acima.
  }
}

// Taxonomia de recuperação de detrator -- padrão de "closed-loop feedback"
// usado em CX de varejo (contatar -> tentar reverter -> registrar
// resultado), pedido do Victor 08/09/2026: "algo que o mercado de varejo
// usa". "sem_resposta" separado de "perdido" de propósito -- são coisas
// diferentes pra decidir o próximo passo (sem_resposta pode valer tentar
// de novo; perdido é uma decisão já tomada).
export const NPS_DETRATOR_STATUSES = ["nao_contatado", "em_contato", "recuperado", "perdido", "sem_resposta"] as const;
export type NpsDetratorStatus = (typeof NPS_DETRATOR_STATUSES)[number];

export const NPS_DETRATOR_STATUS_LABELS: Record<NpsDetratorStatus, string> = {
  nao_contatado: "Não contatado",
  em_contato: "Em contato",
  recuperado: "Recuperado",
  perdido: "Perdido",
  sem_resposta: "Sem resposta",
};

export const NPS_DETRATOR_STATUS_COLORS: Record<NpsDetratorStatus, string> = {
  nao_contatado: "var(--status-critical)",
  em_contato: "var(--status-warning)",
  recuperado: "var(--status-good)",
  perdido: "var(--text-muted)",
  sem_resposta: "var(--status-serious)",
};

export function isNpsDetratorStatus(value: string): value is NpsDetratorStatus {
  return (NPS_DETRATOR_STATUSES as readonly string[]).includes(value);
}

export type NpsDetrator = {
  origem: NpsDetratorOrigem;
  origemId: string;
  score: number;
  escala: "1-5" | "0-10";
  respondidoEm: string;
  clientName: string | null;
  clientPhone: string | null;
  status: NpsDetratorStatus;
  motivo: string | null;
  atualizadoEm: string | null;
  // Resumo automático da conversa do GHL (v_ticket_enriched.summary_ai) --
  // pedido do Victor 08/09/2026: "você que tem que me trazer qual foi o
  // motivo, pois tem dentro da conversa do GHL". Só existe pra origem "sac"
  // (é a única com conversa de atendimento de verdade por trás -- montagem/
  // assistência técnica respondem a pesquisa avulsa, sem esse resumo).
  // Preenche o campo Motivo como sugestão editável, nunca sobrescreve um
  // motivo que o time já registrou.
  motivoSugerido: string | null;
};

type StatusRow = { origem: string; origem_id: string; status: string; motivo: string | null; atualizado_em: string };

// Só os últimos 6 meses -- lista de trabalho ("quem eu preciso ligar"), não
// relatório histórico; sem esse corte só cresceria pra sempre.
const LOOKBACK_MS = 180 * 24 * 60 * 60 * 1000;

// `todoHistorico`: a Central de Recuperação (pedido do Victor 14/10/2026)
// quer todos os detratores, sem o corte de 6 meses.
export async function listNpsDetratores(opts: { todoHistorico?: boolean } = {}): Promise<NpsDetrator[]> {
  const admin = getSupabaseAdmin();
  const sinceIso = opts.todoHistorico ? "1970-01-01T00:00:00Z" : new Date(Date.now() - LOOKBACK_MS).toISOString();

  const [
    { data: sacRows, error: sacError },
    { data: reqRows, error: reqError },
    { data: compraRows, error: compraError },
    { data: entregaRows, error: entregaError },
    { data: vendaRows, error: vendaError },
    { data: statusRows, error: statusError },
  ] = await Promise.all([
    admin
      .from("conversations")
      .select("id, nps_score, nps_answered_at, contact_id")
      .not("nps_score", "is", null)
      .lte("nps_score", 2)
      .gte("nps_answered_at", sinceIso)
      .order("nps_answered_at", { ascending: false }),
    admin
      .from("service_request_nps")
      .select("request_id, tipo, score, respondido_em, service_requests(client_name, client_phone)")
      .not("score", "is", null)
      .lte("score", 2)
      .gte("respondido_em", sinceIso)
      .order("respondido_em", { ascending: false }),
    admin
      .from("compra_nps")
      .select("order_id, client_id, score, respondido_em, totvs_orders(client_name)")
      .is("descartada_em", null)
      .not("score", "is", null)
      .lte("score", 2)
      .gte("respondido_em", sinceIso)
      .order("respondido_em", { ascending: false }),
    // "Pós-entrega" (entregaNps.ts) -- mesma forma de compra_nps acima
    // (por PEDIDO de venda, não por chamado), tabela própria desde
    // 22/09/2026.
    admin
      .from("entrega_nps")
      .select("order_id, client_id, score, respondido_em, totvs_orders(client_name)")
      .is("descartada_em", null)
      .not("score", "is", null)
      .lte("score", 2)
      .gte("respondido_em", sinceIso)
      .order("respondido_em", { ascending: false }),
    // "Pós-venda" (vendaNps.ts) -- mesma forma de "entrega"/"compra" acima
    // (por PEDIDO de venda, não por chamado), tabela própria desde
    // 19/10/2026.
    admin
      .from("venda_nps")
      .select("order_id, client_id, score, respondido_em, totvs_orders(client_name)")
      .not("score", "is", null)
      .lte("score", 2)
      .gte("respondido_em", sinceIso)
      .order("respondido_em", { ascending: false }),
    admin.from("nps_detrator_status").select("origem, origem_id, status, motivo, atualizado_em"),
  ]);
  if (sacError) throw new Error(sacError.message);
  if (entregaError) throw new Error(entregaError.message);
  if (vendaError) throw new Error(vendaError.message);
  if (reqError) throw new Error(reqError.message);
  if (compraError) throw new Error(compraError.message);
  if (statusError) throw new Error(statusError.message);

  const statusByKey = new Map((statusRows as StatusRow[] | null ?? []).map((r) => [`${r.origem}:${r.origem_id}`, r]));
  function resolveStatus(origem: NpsDetratorOrigem, origemId: string): { status: NpsDetratorStatus; motivo: string | null; atualizadoEm: string | null } {
    const row = statusByKey.get(`${origem}:${origemId}`);
    const status = row && isNpsDetratorStatus(row.status) ? row.status : "nao_contatado";
    return { status, motivo: row?.motivo ?? null, atualizadoEm: row?.atualizado_em ?? null };
  }

  const contactIds = [...new Set((sacRows ?? []).map((r) => r.contact_id).filter((id): id is string => !!id))];
  const contactsById = new Map<string, { name: string | null; phone: string | null }>();
  if (contactIds.length > 0) {
    const { data: contactRows, error: contactsError } = await admin.from("contacts").select("id, name, phone").in("id", contactIds);
    if (contactsError) throw new Error(contactsError.message);
    for (const c of contactRows ?? []) contactsById.set(c.id, { name: c.name, phone: c.phone });
  }

  // Resumo automático da conversa (ver comentário no tipo NpsDetrator acima)
  // -- v_ticket_enriched não tem linha pra toda conversa (só quem já foi
  // classificado, ver sync-ai-classify), então nem todo detrator do SAC vai
  // ter sugestão; sem sugestão o campo fica em branco pro time preencher à
  // mão mesmo, sem quebrar nada.
  const sacConversationIds = (sacRows ?? []).map((r) => r.id as string);
  const summaryByConversationId = new Map<string, string | null>();
  if (sacConversationIds.length > 0) {
    const { data: summaryRows, error: summaryError } = await admin
      .from("v_ticket_enriched")
      .select("conversation_id, summary_ai")
      .in("conversation_id", sacConversationIds);
    if (summaryError) throw new Error(summaryError.message);
    for (const s of summaryRows ?? []) summaryByConversationId.set(s.conversation_id as string, s.summary_ai as string | null);
  }

  const sac: NpsDetrator[] = (sacRows ?? [])
    .filter((r) => r.nps_answered_at)
    .map((r) => {
      const contact = r.contact_id ? contactsById.get(r.contact_id) : null;
      const resolved = resolveStatus("sac", r.id);
      return {
        origem: "sac" as const,
        origemId: r.id as string,
        score: r.nps_score as number,
        escala: "1-5" as const,
        respondidoEm: r.nps_answered_at as string,
        clientName: contact?.name ?? null,
        clientPhone: contact?.phone ?? null,
        motivoSugerido: summaryByConversationId.get(r.id as string) ?? null,
        ...resolved,
      };
    });

  type ReqRow = {
    request_id: string;
    tipo: string;
    score: number;
    respondido_em: string;
    service_requests: { client_name: string | null; client_phone: string | null } | { client_name: string | null; client_phone: string | null }[] | null;
  };
  const req: NpsDetrator[] = ((reqRows ?? []) as unknown as ReqRow[]).map((r) => {
    const sr = Array.isArray(r.service_requests) ? r.service_requests[0] : r.service_requests;
    // "entrega" não é mais gravado aqui desde 22/09/2026 -- virou pesquisa
    // própria (entrega_nps, sobre a compra, não sobre um chamado, ver
    // classifyNpsTipo em api/sync/route.ts) -- fallback continua aceitando
    // o valor por segurança (linha antiga que já exista no banco), mas
    // nada novo grava isso aqui.
    const origem = (r.tipo === "montagem" ? "montagem" : "assistencia_tecnica") as NpsDetratorOrigem;
    const resolved = resolveStatus(origem, r.request_id);
    return {
      origem,
      origemId: r.request_id,
      score: r.score,
      escala: "1-5" as const,
      respondidoEm: r.respondido_em,
      clientName: sr?.client_name ?? null,
      clientPhone: sr?.client_phone ?? null,
      motivoSugerido: null,
      ...resolved,
    };
  });

  // Telefone dos detratores de "compra" -- totvs_orders não tem, só o
  // cadastro (mesmo join client_id = protheus_code do resto do projeto).
  type CompraRow = {
    order_id: string;
    client_id: string;
    score: number;
    respondido_em: string;
    totvs_orders: { client_name: string | null } | { client_name: string | null }[] | null;
  };
  const compraClientIds = [...new Set(((compraRows ?? []) as CompraRow[]).map((r) => r.client_id))];
  const phoneByClientId = new Map<string, string | null>();
  if (compraClientIds.length > 0) {
    const { data: clienteRows, error: clientesError } = await admin.from("totvs_clientes").select("protheus_code, phone1").in("protheus_code", compraClientIds);
    if (clientesError) throw new Error(clientesError.message);
    for (const c of clienteRows ?? []) phoneByClientId.set(c.protheus_code as string, c.phone1 as string | null);
  }
  const compra: NpsDetrator[] = ((compraRows ?? []) as CompraRow[]).map((r) => {
    const order = Array.isArray(r.totvs_orders) ? r.totvs_orders[0] : r.totvs_orders;
    const resolved = resolveStatus("compra", r.order_id);
    return {
      origem: "compra" as const,
      origemId: r.order_id,
      score: r.score,
      escala: "1-5" as const,
      respondidoEm: r.respondido_em,
      clientName: order?.client_name ?? null,
      clientPhone: phoneByClientId.get(r.client_id) ?? null,
      motivoSugerido: null,
      ...resolved,
    };
  });

  // "Pós-entrega" (entrega_nps) -- mesma forma de "compra" acima (por
  // PEDIDO de venda, telefone via totvs_clientes).
  type EntregaRow = CompraRow;
  const entregaClientIds = [...new Set(((entregaRows ?? []) as EntregaRow[]).map((r) => r.client_id))];
  const phoneByClientIdEntrega = new Map<string, string | null>();
  if (entregaClientIds.length > 0) {
    const { data: clienteRows, error: clientesError } = await admin.from("totvs_clientes").select("protheus_code, phone1").in("protheus_code", entregaClientIds);
    if (clientesError) throw new Error(clientesError.message);
    for (const c of clienteRows ?? []) phoneByClientIdEntrega.set(c.protheus_code as string, c.phone1 as string | null);
  }
  const entrega: NpsDetrator[] = ((entregaRows ?? []) as EntregaRow[]).map((r) => {
    const order = Array.isArray(r.totvs_orders) ? r.totvs_orders[0] : r.totvs_orders;
    const resolved = resolveStatus("entrega", r.order_id);
    return {
      origem: "entrega" as const,
      origemId: r.order_id,
      score: r.score,
      escala: "1-5" as const,
      respondidoEm: r.respondido_em,
      clientName: order?.client_name ?? null,
      clientPhone: phoneByClientIdEntrega.get(r.client_id) ?? null,
      motivoSugerido: null,
      ...resolved,
    };
  });

  // "Pós-venda" (venda_nps) -- mesma forma de "entrega"/"compra" acima (por
  // PEDIDO de venda, telefone via totvs_clientes).
  type VendaRow = CompraRow;
  const vendaClientIds = [...new Set(((vendaRows ?? []) as VendaRow[]).map((r) => r.client_id))];
  const phoneByClientIdVenda = new Map<string, string | null>();
  if (vendaClientIds.length > 0) {
    const { data: clienteRows, error: clientesError } = await admin.from("totvs_clientes").select("protheus_code, phone1").in("protheus_code", vendaClientIds);
    if (clientesError) throw new Error(clientesError.message);
    for (const c of clienteRows ?? []) phoneByClientIdVenda.set(c.protheus_code as string, c.phone1 as string | null);
  }
  const venda: NpsDetrator[] = ((vendaRows ?? []) as VendaRow[]).map((r) => {
    const order = Array.isArray(r.totvs_orders) ? r.totvs_orders[0] : r.totvs_orders;
    const resolved = resolveStatus("venda", r.order_id);
    return {
      origem: "venda" as const,
      origemId: r.order_id,
      score: r.score,
      escala: "1-5" as const,
      respondidoEm: r.respondido_em,
      clientName: order?.client_name ?? null,
      clientPhone: phoneByClientIdVenda.get(r.client_id) ?? null,
      motivoSugerido: null,
      ...resolved,
    };
  });

  // Vendas do Odoo (venda_nps_odoo, desde 25/10): origemId "odoo:<pedido>",
  // telefone e cliente gravados no envio.
  const { data: odooRows, error: odooError } = await admin
    .from("venda_nps_odoo")
    .select("pedido, cliente, telefone, score, respondido_em")
    .is("descartada_em", null)
    .not("score", "is", null)
    .lte("score", 2)
    .gte("respondido_em", sinceIso)
    .order("respondido_em", { ascending: false });
  if (odooError) throw new Error(odooError.message);
  const vendaOdoo: NpsDetrator[] = (odooRows ?? []).map((r) => {
    const origemId = `odoo:${r.pedido}`;
    return {
      origem: "venda" as const,
      origemId,
      score: r.score as number,
      escala: "1-5" as const,
      respondidoEm: r.respondido_em as string,
      clientName: (r.cliente as string | null) ?? null,
      clientPhone: (r.telefone as string | null) ?? null,
      motivoSugerido: null,
      ...resolveStatus("venda", origemId),
    };
  });

  return [...sac, ...req, ...compra, ...entrega, ...venda, ...vendaOdoo].sort((a, b) => b.respondidoEm.localeCompare(a.respondidoEm));
}

export type NpsResposta = {
  origemId: string;
  score: number;
  respondidoEm: string;
  clientName: string | null;
  // null quando a fonte não tem CPF nenhum (sac -- conversa do GHL, sem
  // venda por trás). montagem/assistência técnica vêm de
  // service_requests.client_cpf; compra/entrega vêm de
  // totvs_orders.client_cpf_cnpj.
  clientCpf: string | null;
  clientPhone: string | null;
  // Só preenchido pra "compra"/"entrega"/"venda" (vem de totvs_orders.seller_name
  // -- quem vendeu aquele pedido) -- pedido do Victor 19/10/2026 pro card
  // "Pós-venda" mostrar a qual vendedor cada avaliação se refere. null nas
  // outras fontes (sac/montagem/assistência técnica não têm vendedor
  // associado ao dado que já buscam).
  sellerName: string | null;
};

// Lista TODAS as respostas de UMA fase (não só detratores, diferente de
// listNpsDetratores acima) -- pedido do Victor 28/09/2026: card clicável no
// Resumo (AvaliacoesResumo.tsx) mostrando quem respondeu, com nome + CPF/
// telefone + nota. Busca só a fase pedida (não as 5 juntas) -- chamada sob
// demanda quando o card é aberto, não precarrega nada na tela de Resumo.
export async function listNpsRespostasPorFase(origem: NpsDetratorOrigem, limit = 300): Promise<NpsResposta[]> {
  const admin = getSupabaseAdmin();

  if (origem === "sac") {
    const { data, error } = await admin
      .from("conversations")
      .select("id, nps_score, nps_answered_at, contact_id")
      .not("nps_score", "is", null)
      .not("nps_answered_at", "is", null)
      .order("nps_answered_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);

    const contactIds = [...new Set((data ?? []).map((r) => r.contact_id).filter((id): id is string => !!id))];
    const contactsById = new Map<string, { name: string | null; phone: string | null }>();
    if (contactIds.length > 0) {
      const { data: contactRows, error: contactsError } = await admin.from("contacts").select("id, name, phone").in("id", contactIds);
      if (contactsError) throw new Error(contactsError.message);
      for (const c of contactRows ?? []) contactsById.set(c.id, { name: c.name, phone: c.phone });
    }
    return (data ?? []).map((r) => {
      const contact = r.contact_id ? contactsById.get(r.contact_id) : null;
      return {
        origemId: r.id as string,
        score: r.nps_score as number,
        respondidoEm: r.nps_answered_at as string,
        clientName: contact?.name ?? null,
        clientCpf: null,
        clientPhone: contact?.phone ?? null,
        sellerName: null,
      };
    });
  }

  if (origem === "montagem" || origem === "assistencia_tecnica") {
    const { data, error } = await admin
      .from("service_request_nps")
      .select("request_id, score, respondido_em, service_requests(client_name, client_phone, client_cpf)")
      .eq("tipo", origem)
      .not("score", "is", null)
      .order("respondido_em", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);

    type Row = {
      request_id: string;
      score: number;
      respondido_em: string;
      service_requests:
        | { client_name: string | null; client_phone: string | null; client_cpf: string | null }
        | { client_name: string | null; client_phone: string | null; client_cpf: string | null }[]
        | null;
    };
    return ((data ?? []) as unknown as Row[]).map((r) => {
      const sr = Array.isArray(r.service_requests) ? r.service_requests[0] : r.service_requests;
      return {
        origemId: r.request_id,
        score: r.score,
        respondidoEm: r.respondido_em,
        clientName: sr?.client_name ?? null,
        clientCpf: sr?.client_cpf ?? null,
        clientPhone: sr?.client_phone ?? null,
        sellerName: null,
      };
    });
  }

  // "compra", "entrega" e "venda" -- mesma forma (por pedido de venda, não
  // por chamado), só a tabela muda. seller_name vem junto (quem vendeu o
  // pedido) -- usado pelo card "Pós-venda" pra mostrar a qual vendedor
  // cada avaliação se refere.
  const table = origem === "compra" ? "compra_nps" : origem === "entrega" ? "entrega_nps" : "venda_nps";
  const { data, error } = await admin
    .from(table)
    .select("order_id, client_id, score, respondido_em, totvs_orders(client_name, client_cpf_cnpj, seller_name)")
    // descartadas (0201): enviadas pra pessoa errada, não contam
    .is("descartada_em", null)
    .not("score", "is", null)
    .order("respondido_em", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  type Row = {
    order_id: string;
    client_id: string;
    score: number;
    respondido_em: string;
    totvs_orders:
      | { client_name: string | null; client_cpf_cnpj: string | null; seller_name: string | null }
      | { client_name: string | null; client_cpf_cnpj: string | null; seller_name: string | null }[]
      | null;
  };
  const rows = (data ?? []) as unknown as Row[];
  // Telefone só de reforço (nem sempre tem CPF sincronizado) -- mesmo join
  // client_id = protheus_code de listNpsDetratores acima.
  const clientIds = [...new Set(rows.map((r) => r.client_id))];
  const phoneByClientId = new Map<string, string | null>();
  if (clientIds.length > 0) {
    const { data: clienteRows, error: clientesError } = await admin.from("totvs_clientes").select("protheus_code, phone1").in("protheus_code", clientIds);
    if (clientesError) throw new Error(clientesError.message);
    for (const c of clienteRows ?? []) phoneByClientId.set(c.protheus_code as string, c.phone1 as string | null);
  }
  const respostas: NpsResposta[] = rows.map((r) => {
    const order = Array.isArray(r.totvs_orders) ? r.totvs_orders[0] : r.totvs_orders;
    return {
      origemId: r.order_id,
      score: r.score,
      respondidoEm: r.respondido_em,
      clientName: order?.client_name ?? null,
      clientCpf: order?.client_cpf_cnpj ?? null,
      clientPhone: phoneByClientId.get(r.client_id) ?? null,
      sellerName: order?.seller_name ?? null,
    };
  });
  if (origem !== "venda") return respostas;
  // Pós-venda das vendas do Odoo (venda_nps_odoo, desde 25/10).
  const { data: odoo, error: odooError } = await admin
    .from("venda_nps_odoo")
    .select("pedido, cliente, telefone, vendedor, score, respondido_em")
    .is("descartada_em", null)
    .not("score", "is", null)
    .order("respondido_em", { ascending: false })
    .limit(limit);
  if (odooError) throw new Error(odooError.message);
  const doOdoo: NpsResposta[] = (odoo ?? []).map((r) => ({
    origemId: `odoo:${r.pedido}`,
    score: r.score as number,
    respondidoEm: r.respondido_em as string,
    clientName: (r.cliente as string | null) ?? null,
    clientCpf: null,
    clientPhone: (r.telefone as string | null) ?? null,
    sellerName: (r.vendedor as string | null) ?? null,
  }));
  return [...respostas, ...doOdoo].sort((a, b) => b.respondidoEm.localeCompare(a.respondidoEm)).slice(0, limit);
}

// sentCount/responseRatePct adicionados em 19/10/2026 -- pedido do Victor:
// "em cada card do resumo de avaliações, apareça não só as respostas mas
// qual o percentual de respostas e quantas foram enviadas". responseCount
// sozinho não dizia se uma taxa de resposta baixa era "pouca gente
// respondeu" ou "quase não enviamos nada ainda" -- achado real da sessão
// (NPS Compra em Draft no GHL por 3 semanas, enviando "sucesso" sem
// mandar mensagem nenhuma) mostrou que essa distinção importa de verdade.
export type NpsFaseResumo = { npsIndex: number | null; responseCount: number; sentCount: number; responseRatePct: number | null };

// Resumo (NPS clássico: %promotores - %detratores) pras fases que ainda não
// têm uma função de summary própria feito nem_summary.ts tem pro SAC --
// pedido do Victor 08/09/2026: "a primeira aba [de /avaliacoes] seja
// desse resumo de avaliações de todas as fases". Devolve responseCount:0 +
// npsIndex:null quando não tem nenhuma resposta ainda (vira "—" na tela) --
// não precisa de código novo quando montagem/assistência técnica
// começarem a responder de verdade, já calcula sozinho.
export async function getNpsResumoPorFaseAdicional(): Promise<Record<"montagem" | "assistencia_tecnica" | "entrega" | "venda", NpsFaseResumo>> {
  const admin = getSupabaseAdmin();
  // "entrega"/"venda" vêm de tabela separada cada uma (entrega_nps/
  // venda_nps, ver entregaNps.ts/vendaNps.ts) -- por PEDIDO de venda, não
  // por chamado de assistência (service_request_nps). Consulta própria
  // aqui em vez de importar de lá pra não criar dependência circular
  // (aqueles arquivos já importam NPS_GHL_TAG daqui).
  //
  // Score continua filtrado (`.not("score", "is", null)`) -- só quem
  // respondeu, poucas centenas no máximo, sem risco de estourar o limite
  // padrão de 1000 linhas do PostgREST. sentCount (TOTAL enviado, pode
  // passar de 1000 em entrega/venda) vem de queries à parte com `count:
  // "exact", head: true` -- head não baixa linha nenhuma, só o total, e
  // por isso nunca trunca (achado 19/10/2026, mesmo gotcha já corrigido em
  // backfillMissingClients/totvsSync.ts: um `.select()` sem `.range()` em
  // tabela grande corta silenciosamente em 1000).
  const [
    { data, error },
    { data: entregaData, error: entregaError },
    { data: vendaData, error: vendaError },
    { count: montagemSent, error: montagemSentError },
    { count: assistSent, error: assistSentError },
    { count: entregaSent, error: entregaSentError },
    { count: vendaSent, error: vendaSentError },
    { data: vendaOdooData, error: vendaOdooError },
    { count: vendaOdooSent, error: vendaOdooSentError },
  ] = await Promise.all([
    admin.from("service_request_nps").select("tipo, score").not("score", "is", null),
    admin.from("entrega_nps").select("score").is("descartada_em", null).not("score", "is", null),
    admin.from("venda_nps").select("score").not("score", "is", null),
    admin.from("service_request_nps").select("request_id", { count: "exact", head: true }).eq("tipo", "montagem"),
    admin.from("service_request_nps").select("request_id", { count: "exact", head: true }).eq("tipo", "assistencia_tecnica"),
    admin.from("entrega_nps").select("order_id", { count: "exact", head: true }).is("descartada_em", null),
    admin.from("venda_nps").select("order_id", { count: "exact", head: true }),
    admin.from("venda_nps_odoo").select("score").is("descartada_em", null).not("score", "is", null),
    admin.from("venda_nps_odoo").select("pedido", { count: "exact", head: true }).is("descartada_em", null),
  ]);
  if (vendaOdooError) throw new Error(vendaOdooError.message);
  if (vendaOdooSentError) throw new Error(vendaOdooSentError.message);
  if (error) throw new Error(error.message);
  if (entregaError) throw new Error(entregaError.message);
  if (vendaError) throw new Error(vendaError.message);
  if (montagemSentError) throw new Error(montagemSentError.message);
  if (assistSentError) throw new Error(assistSentError.message);
  if (entregaSentError) throw new Error(entregaSentError.message);
  if (vendaSentError) throw new Error(vendaSentError.message);

  // Classificação NPS adaptada pra escala 1-5 (mesmo critério de
  // buildNpsSummary, kpi.ts/SAC, desde 22/09/2026): promotor 4-5, detrator
  // 1-2, sem o "6" do meio que a escala 0-10 original teria como corte.
  function npsFromScores(scores: number[], sentCount: number): NpsFaseResumo {
    const responseRatePct = sentCount > 0 ? Math.round((scores.length / sentCount) * 100) : null;
    if (scores.length === 0) return { npsIndex: null, responseCount: 0, sentCount, responseRatePct };
    const promoters = scores.filter((s) => s >= 4).length;
    const detractors = scores.filter((s) => s <= 2).length;
    const npsIndex = Math.round(((promoters - detractors) / scores.length) * 100);
    return { npsIndex, responseCount: scores.length, sentCount, responseRatePct };
  }
  function resumoFor(tipo: "montagem" | "assistencia_tecnica", sentCount: number): NpsFaseResumo {
    return npsFromScores(
      (data ?? []).filter((r) => r.tipo === tipo).map((r) => r.score as number),
      sentCount
    );
  }

  return {
    montagem: resumoFor("montagem", montagemSent ?? 0),
    assistencia_tecnica: resumoFor("assistencia_tecnica", assistSent ?? 0),
    entrega: npsFromScores((entregaData ?? []).map((r) => r.score as number), entregaSent ?? 0),
    venda: npsFromScores(
      [...(vendaData ?? []), ...(vendaOdooData ?? [])].map((r) => r.score as number),
      (vendaSent ?? 0) + (vendaOdooSent ?? 0)
    ),
  };
}

export async function registrarStatusDetrator(
  origem: NpsDetratorOrigem,
  origemId: string,
  opts: { status: NpsDetratorStatus; motivo: string | null }
): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("nps_detrator_status").upsert(
    {
      origem,
      origem_id: origemId,
      status: opts.status,
      motivo: opts.motivo,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: "origem,origem_id" }
  );
  if (error) throw new Error(error.message);
}
