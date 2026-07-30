import { getSupabaseAdmin } from "./supabaseAdmin";
import { addBusinessDays } from "./businessDays";

// A regra de negócio compara RÓTULOS texto ("Programada", "Entregue",
// "Cancelada"), nunca os códigos numéricos do TOTVS: statusEntregaCodigo é
// ambíguo entre os namespaces "CARGA"/"ENTREGA" (mesmos números reaproveitados
// com sentidos diferentes -- ver DeliveryCarga em api-totvs.yaml), e o pedido
// em si nem expõe qual namespace está em uso pra cada carga. Rótulos são
// estáveis e enumerados no schema, sem essa ambiguidade.

export type EntregaRiscoNivel = "alerta" | "acompanhamento";

const CARGA_ABERTA_LABELS = ["Programada", "Faturada", "Liberada", "Em Rota"];
const RESOLVIDO_LABELS = ["Entregue", "Entregue Parcial"];
const PRAZO_DIAS_UTEIS = 5;

export type EntregaRiscoCarga = {
  carga: string;
  dtPrevisao: string | null;
  tentativa: number | null;
  tipoEntrega: string | null;
  statusCarga: string | null;
  statusEntrega: string | null;
  motoristaNome: string | null;
  transportadora: string | null;
  notaFiscal: string | null;
  serie: string | null;
};

export type EntregaRiscoClassificacao = {
  note: string | null;
  reavaliarEm: string | null;
  classifiedByName: string;
  classifiedByRole: string;
  updatedAt: string;
};

export type EntregaRiscoItem = {
  pedido: string;
  filialVenda: string;
  loja: string | null;
  clienteNome: string | null;
  clienteDocumento: string | null;
  clienteBairro: string | null;
  clienteMunicipio: string | null;
  clienteUf: string | null;
  nivel: EntregaRiscoNivel;
  motivo: string;
  baselineData: string;
  baselineOrigem: "nota_fiscal" | "primeiro_sync";
  cargaAtual: EntregaRiscoCarga | null;
  classificacao: EntregaRiscoClassificacao | null;
};

// Regras 1-3 do plano da feature: compara rótulos de status contra o prazo
// de PRAZO_DIAS_UTEIS dias úteis após a data-base da venda. Retorna `null`
// quando o pedido ainda está dentro do prazo sem carga -- não deve aparecer
// na lista. Regras 4-7 (gatilho de cancelamento e snooze manual) são
// aplicadas por cima em listEntregasEmRisco, que é quem tem acesso ao
// histórico/classificação.
export function computeRiscoAutomatico(
  cargas: EntregaRiscoCarga[],
  baselineIso: string,
  todayIso: string
): { nivel: EntregaRiscoNivel; motivo: string } | null {
  const deadline = addBusinessDays(baselineIso, PRAZO_DIAS_UTEIS);
  const abertas = cargas.filter((c) => CARGA_ABERTA_LABELS.includes(c.statusCarga ?? ""));

  if (abertas.length === 0) {
    if (todayIso > deadline) {
      return { nivel: "alerta", motivo: `Sem carga agendada até o 5º dia útil após a venda (${deadline}).` };
    }
    return null;
  }

  const proxima = abertas.reduce<EntregaRiscoCarga | null>(
    (min, c) => (!min || (c.dtPrevisao ?? "9999-99-99") < (min.dtPrevisao ?? "9999-99-99") ? c : min),
    null
  );
  if (!proxima) return null;

  if ((proxima.dtPrevisao ?? "") <= deadline) {
    return { nivel: "acompanhamento", motivo: `Carga ${proxima.carga} agendada para ${proxima.dtPrevisao} — dentro do prazo.` };
  }
  return { nivel: "alerta", motivo: `Carga ${proxima.carga} agendada para ${proxima.dtPrevisao} — além do 5º dia útil (${deadline}).` };
}

// Estratégia de "data da venda": o payload de /ai/deliveries não expõe esse
// campo (só as cargas têm dtPrevisao/dtRetorno) -- ver risco técnico no plano
// da feature. Prioridade pra data de emissão da NF (totvs_orders.issue_date),
// cruzada em código via nota_fiscal+serie de qualquer carga já faturada;
// fallback pra first_seen_at (quando vimos o pedido pela 1ª vez no nosso
// sync) se nenhuma carga tem nota fiscal ainda -- caso mais crítico da regra
// 1, pedido ainda "Em Montagem"/"Em Separação".
export function baselineFor(
  cargas: { notaFiscal: string | null; serie: string | null }[],
  ordersByInvoiceSerie: Map<string, string>,
  firstSeenAt: string
): { data: string; origem: "nota_fiscal" | "primeiro_sync" } {
  const datas = cargas
    .filter((c) => c.notaFiscal && c.serie)
    .map((c) => ordersByInvoiceSerie.get(`${c.notaFiscal}|${c.serie}`))
    .filter((d): d is string => !!d);

  if (datas.length > 0) {
    return { data: datas.reduce((min, d) => (d < min ? d : min)), origem: "nota_fiscal" };
  }
  return { data: firstSeenAt.slice(0, 10), origem: "primeiro_sync" };
}

type DeliveryCargaRow = {
  carga: string;
  dt_previsao: string | null;
  tentativa: number | null;
  tipo_entrega: string | null;
  status_carga: string | null;
  status_entrega: string | null;
  motorista_nome: string | null;
  transportadora: string | null;
  nota_fiscal: string | null;
  serie: string | null;
};

type DeliveryRow = {
  pedido: string;
  filial_venda: string;
  loja: string | null;
  client_name: string | null;
  client_cpf_cnpj: string | null;
  client_neighborhood: string | null;
  client_city: string | null;
  client_state: string | null;
  status_atual: string | null;
  first_seen_at: string;
  risk_trigger_at: string | null;
  risk_trigger_reason: string | null;
  totvs_delivery_cargas: DeliveryCargaRow[] | null;
};

type ClassificacaoRow = {
  pedido: string;
  filial_venda: string;
  note: string | null;
  reavaliar_em: string | null;
  classified_by_name: string;
  classified_by_role: string;
  updated_at: string;
};

const DELIVERY_COLUMNS =
  "pedido, filial_venda, loja, client_name, client_cpf_cnpj, client_neighborhood, client_city, client_state, status_atual, first_seen_at, risk_trigger_at, risk_trigger_reason, " +
  "totvs_delivery_cargas(carga, dt_previsao, tentativa, tipo_entrega, status_carga, status_entrega, motorista_nome, transportadora, nota_fiscal, serie)";

function toEntregaRiscoCarga(row: DeliveryCargaRow): EntregaRiscoCarga {
  return {
    carga: row.carga,
    dtPrevisao: row.dt_previsao,
    tentativa: row.tentativa,
    tipoEntrega: row.tipo_entrega,
    statusCarga: row.status_carga,
    statusEntrega: row.status_entrega,
    motoristaNome: row.motorista_nome,
    transportadora: row.transportadora,
    notaFiscal: row.nota_fiscal,
    serie: row.serie,
  };
}

export async function listEntregasEmRisco(): Promise<EntregaRiscoItem[]> {
  const admin = getSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);

  const { data: deliveryRows, error } = await admin.from("totvs_deliveries").select(DELIVERY_COLUMNS);
  if (error) throw new Error(error.message);

  const deliveries = ((deliveryRows ?? []) as unknown as DeliveryRow[]).filter(
    (d) => !RESOLVIDO_LABELS.includes(d.status_atual ?? "")
  );
  if (deliveries.length === 0) return [];

  const invoices = [
    ...new Set(
      deliveries.flatMap((d) => (d.totvs_delivery_cargas ?? []).map((c) => c.nota_fiscal).filter((v): v is string => !!v))
    ),
  ];
  const { data: orderRows } = invoices.length
    ? await admin.from("totvs_orders").select("invoice, serie, issue_date").in("invoice", invoices)
    : { data: [] as { invoice: string; serie: string; issue_date: string }[] };
  const ordersByInvoiceSerie = new Map((orderRows ?? []).map((o) => [`${o.invoice}|${o.serie}`, o.issue_date]));

  const pedidos = [...new Set(deliveries.map((d) => d.pedido))];
  const { data: statusRows } = pedidos.length
    ? await admin.from("entrega_risco_status").select("*").in("pedido", pedidos)
    : { data: [] as ClassificacaoRow[] };
  const statusByKey = new Map(
    ((statusRows ?? []) as unknown as ClassificacaoRow[]).map((s) => [`${s.pedido}|${s.filial_venda}`, s])
  );

  const items: EntregaRiscoItem[] = [];
  for (const d of deliveries) {
    const cargas = (d.totvs_delivery_cargas ?? []).map(toEntregaRiscoCarga);
    const baseline = baselineFor(cargas, ordersByInvoiceSerie, d.first_seen_at);
    const classificacaoRow = statusByKey.get(`${d.pedido}|${d.filial_venda}`);

    let risco = computeRiscoAutomatico(cargas, baseline.data, today);

    // Regra 4: gatilho de cancelamento gravado pelo sync sempre sobrepõe uma
    // classificação manual em snooze, desde que seja mais recente que ela.
    const overrideAtivo = !!d.risk_trigger_at && (!classificacaoRow || d.risk_trigger_at > classificacaoRow.updated_at);
    if (overrideAtivo) {
      risco = { nivel: "alerta", motivo: d.risk_trigger_reason ?? "Carga cancelada ou pedido retirado da carga." };
    }
    if (!risco) continue;

    // Regras 6-7: snooze manual suprime o item até a data de reavaliação,
    // exceto quando o gatilho de cancelamento acabou de sobrepor (acima).
    const snoozeAtivo = !overrideAtivo && !!classificacaoRow?.reavaliar_em && classificacaoRow.reavaliar_em > today;
    if (snoozeAtivo) continue;

    const proximaCarga = cargas
      .filter((c) => CARGA_ABERTA_LABELS.includes(c.statusCarga ?? ""))
      .reduce<EntregaRiscoCarga | null>(
        (min, c) => (!min || (c.dtPrevisao ?? "9999-99-99") < (min.dtPrevisao ?? "9999-99-99") ? c : min),
        null
      );

    items.push({
      pedido: d.pedido,
      filialVenda: d.filial_venda,
      loja: d.loja,
      clienteNome: d.client_name,
      clienteDocumento: d.client_cpf_cnpj,
      clienteBairro: d.client_neighborhood,
      clienteMunicipio: d.client_city,
      clienteUf: d.client_state,
      nivel: risco.nivel,
      motivo: risco.motivo,
      baselineData: baseline.data,
      baselineOrigem: baseline.origem,
      cargaAtual: proximaCarga,
      classificacao: classificacaoRow
        ? {
            note: classificacaoRow.note,
            reavaliarEm: classificacaoRow.reavaliar_em,
            classifiedByName: classificacaoRow.classified_by_name,
            classifiedByRole: classificacaoRow.classified_by_role,
            updatedAt: classificacaoRow.updated_at,
          }
        : null,
    });
  }

  return items.sort((a, b) => (a.nivel === b.nivel ? 0 : a.nivel === "alerta" ? -1 : 1));
}

export async function classifyEntregaRisco(
  pedido: string,
  filialVenda: string,
  actor: { name: string; role: string },
  input: { note: string | null; reavaliarEm: string | null }
): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("entrega_risco_status").upsert(
    {
      pedido,
      filial_venda: filialVenda,
      note: input.note?.trim() || null,
      reavaliar_em: input.reavaliarEm,
      classified_by_name: actor.name,
      classified_by_role: actor.role,
    },
    { onConflict: "pedido,filial_venda" }
  );
  if (error) throw new Error(error.message);

  const { error: eventError } = await admin.from("entrega_risco_events").insert({
    pedido,
    filial_venda: filialVenda,
    actor_name: actor.name,
    actor_role: actor.role,
    event_type: "classificado",
    note: input.note?.trim() || null,
    reavaliar_em: input.reavaliarEm,
  });
  if (eventError) throw new Error(eventError.message);
}

export async function countEntregasEmRiscoOverview(): Promise<{ alerta: number; acompanhamento: number }> {
  const items = await listEntregasEmRisco();
  return {
    alerta: items.filter((i) => i.nivel === "alerta").length,
    acompanhamento: items.filter((i) => i.nivel === "acompanhamento").length,
  };
}
