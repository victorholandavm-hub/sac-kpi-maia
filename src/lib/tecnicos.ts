import { getSupabaseAdmin } from "./supabaseAdmin";
import type { RequestType } from "./serviceRequests";

// Equipe técnica: recebe o motorista na volta da rota (produto recolhido em
// troca_produto, principalmente) e decide o destino de cada item. Portal
// próprio, login por nome+PIN igual a montador/motorista -- ver
// tecnicoAuth.ts / tecnico-actions.ts.

export const ITEM_DESTINOS = ["fabrica", "estoque", "conserto", "sem_condicoes"] as const;
export type ItemDestino = (typeof ITEM_DESTINOS)[number];

export function isItemDestino(value: string | undefined | null): value is ItemDestino {
  return !!value && (ITEM_DESTINOS as readonly string[]).includes(value);
}

export const ITEM_DESTINO_LABELS: Record<ItemDestino, string> = {
  fabrica: "Enviar pra fábrica",
  estoque: "Voltar pro estoque",
  conserto: "Conserto",
  sem_condicoes: "Sem condições",
};

export const ITEM_DESTINO_COLORS: Record<ItemDestino, string> = {
  fabrica: "var(--series-4)",
  estoque: "var(--status-good)",
  conserto: "var(--status-warning)",
  sem_condicoes: "var(--status-critical)",
};

export type TecnicoWithPinStatus = { name: string; hasPin: boolean };

export async function listTecnicosWithPinStatus(): Promise<TecnicoWithPinStatus[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("tecnicos").select("name, pin_hash").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((t) => ({ name: t.name as string, hasPin: !!t.pin_hash }));
}

// "name" é a PK exata da tabela -- mesmo cuidado de resolveDriverName
// (payments.ts): sem isso, digitar "joão" quando já existe "João" cria uma
// linha duplicada.
export async function resolveTecnicoName(typedName: string): Promise<string> {
  const trimmed = typedName.trim();
  const admin = getSupabaseAdmin();
  const { data } = await admin.from("tecnicos").select("name");
  const existing = (data ?? []).find((t) => (t.name as string).toLowerCase() === trimmed.toLowerCase());
  return existing?.name ?? trimmed;
}

export type TecnicoItem = {
  id: string;
  product: string;
  partCode: string | null;
  quantity: number;
  destino: ItemDestino | null;
  destinoDefinidoPor: string | null;
  destinoDefinidoEm: string | null;
};

export type TecnicoRequestView = {
  id: string;
  ticketNumber: number;
  type: RequestType;
  storeName: string;
  clientName: string | null;
  // CPF, não código do Protheus -- pedido do Victor 20/08/2026: "no lugar
  // do codigo, coloque o cpf" (troca do pedido anterior, "código do
  // cliente").
  clientCpf: string | null;
  clientPhone: string | null;
  clientAddress: string | null;
  clientAddressNumber: string | null;
  clientIsApartment: boolean;
  clientAddressComplement: string | null;
  clientNeighborhood: string | null;
  reason: string | null;
  authorizedBy: string | null;
  restrictionNote: string | null;
  clientTimeRestriction: string | null;
  driverName: string | null;
  completedAt: string | null;
  // Quem abriu a notificação -- pedido do Victor 20/08/2026: "precisa ter
  // também quem solicitou: sac ou assistencia e o nome da pessoa que fez a
  // notificação". Mesmo fallback de ServiceRequestSummary.requestedByName
  // (SummaryRow em serviceRequests.ts): nome do profile logado que criou
  // (requester), senão o texto livre requested_by_name (chamado antigo, de
  // antes do login por Supabase Auth).
  requestedByName: string | null;
  items: TecnicoItem[];
};

const TECNICO_VIEW_LIMIT = 200;
const TECNICO_VIEW_COLUMNS =
  "id, ticket_number, type, store_id, client_name, client_cpf, client_phone, client_address, client_address_number, client_is_apartment, client_address_complement, client_neighborhood, reason, authorized_by, restriction_note, client_time_restriction, driver_name, completed_at, requested_by_name, requester:profiles!requested_by(full_name), stores(name), items:service_request_items(id, product, part_code, quantity, destino, destino_definido_por, destino_definido_em)";

type TecnicoViewRow = {
  id: string;
  ticket_number: number;
  type: RequestType;
  client_name: string | null;
  client_cpf: string | null;
  client_phone: string | null;
  client_address: string | null;
  client_address_number: string | null;
  client_is_apartment: boolean;
  client_address_complement: string | null;
  client_neighborhood: string | null;
  reason: string | null;
  authorized_by: string | null;
  restriction_note: string | null;
  client_time_restriction: string | null;
  driver_name: string | null;
  completed_at: string | null;
  requested_by_name: string | null;
  requester: { full_name: string } | null;
  stores: { name: string } | null;
  items: {
    id: string;
    product: string;
    part_code: string | null;
    quantity: number;
    destino: string | null;
    destino_definido_por: string | null;
    destino_definido_em: string | null;
  }[] | null;
};

function toTecnicoView(row: TecnicoViewRow): TecnicoRequestView {
  return {
    id: row.id,
    ticketNumber: row.ticket_number,
    type: row.type,
    storeName: row.stores?.name ?? "—",
    clientName: row.client_name,
    clientCpf: row.client_cpf,
    clientPhone: row.client_phone,
    clientAddress: row.client_address,
    clientAddressNumber: row.client_address_number,
    clientIsApartment: row.client_is_apartment,
    clientAddressComplement: row.client_address_complement,
    clientNeighborhood: row.client_neighborhood,
    reason: row.reason,
    authorizedBy: row.authorized_by,
    restrictionNote: row.restriction_note,
    clientTimeRestriction: row.client_time_restriction,
    driverName: row.driver_name,
    completedAt: row.completed_at,
    requestedByName: row.requester?.full_name ?? row.requested_by_name ?? null,
    items: (row.items ?? []).map((i) => ({
      id: i.id,
      product: i.product,
      partCode: i.part_code,
      quantity: i.quantity,
      destino: isItemDestino(i.destino) ? i.destino : null,
      destinoDefinidoPor: i.destino_definido_por,
      destinoDefinidoEm: i.destino_definido_em,
    })),
  };
}

// Todo chamado de motorista já concluído (troca/entrega de produto, envio de
// peça) -- pedido do Victor 17/08/2026: a equipe técnica não filtra por tipo,
// vê tudo que voltou de rota, mesmo quando nem todo item vai ter destino pra
// definir (entrega simples não recolhe nada, por exemplo -- fica sem nota
// nenhuma, sem problema).
export async function listRequestsForTecnico(): Promise<TecnicoRequestView[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("service_requests")
    .select(TECNICO_VIEW_COLUMNS)
    .not("driver_name", "is", null)
    .eq("status", "concluida")
    .order("completed_at", { ascending: false })
    .limit(TECNICO_VIEW_LIMIT);
  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as TecnicoViewRow[]).map(toTecnicoView);
}
