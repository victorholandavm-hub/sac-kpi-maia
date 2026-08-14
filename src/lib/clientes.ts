import { getSupabaseAdmin } from "./supabaseAdmin";
import { sanitizeOrFilterValue } from "./searchFilter";

// Perfil de compra/relacionamento dos clientes -- pedido do Victor
// 14/08/2026: "preciso classificar os clientes". A classificação em si
// (ativo/inativo/nunca comprou + dias sem comprar) já vem PRONTA do
// Protheus, sincronizada em totvs_clientes (ver syncClients em
// totvsSync.ts) -- essa tela só organiza/expõe o que já existe, não
// inventa uma lógica de segmentação nova.

export const CLIENTE_STATUSES = ["ativo", "inativo", "nunca comprou"] as const;
export type ClienteStatus = (typeof CLIENTE_STATUSES)[number];

export function isClienteStatus(value: string | undefined | null): value is ClienteStatus {
  return !!value && (CLIENTE_STATUSES as readonly string[]).includes(value);
}

export const CLIENTE_STATUS_LABELS: Record<ClienteStatus, string> = {
  ativo: "Ativo",
  inativo: "Inativo",
  "nunca comprou": "Nunca comprou",
};

export const CLIENTE_STATUS_COLORS: Record<ClienteStatus, string> = {
  ativo: "var(--status-good)",
  inativo: "var(--status-critical)",
  "nunca comprou": "var(--text-muted)",
};

// Faixas de "dias sem comprar" -- só fazem sentido pra quem já comprou
// alguma vez (ativo/inativo); "nunca comprou" não entra nessa quebra (ver
// getClientesResumo). Pensadas pra sinalizar quem está "esfriando" antes
// de virar inativo de vez: 0-30 ainda quente, 31-90 esfriando, 91-180
// alerta, 180+ já bem frio.
const FAIXAS_DIAS = [
  { label: "0–30 dias", min: 0, max: 30 },
  { label: "31–90 dias", min: 31, max: 90 },
  { label: "91–180 dias", min: 91, max: 180 },
  { label: "180+ dias", min: 181, max: null as number | null },
] as const;

export type ClientesResumo = {
  porStatus: { status: ClienteStatus; total: number }[];
  porFaixaDias: { status: ClienteStatus; faixa: string; total: number }[];
  totalGeral: number;
};

// Só contagens (head: true) -- 3.760 clientes hoje cabem numa página só,
// mas conta em vez de trazer linha por linha é mais barato de qualquer
// jeito, e não cresce com a base de clientes do jeito que um SELECT
// completo cresceria.
export async function getClientesResumo(): Promise<ClientesResumo> {
  const admin = getSupabaseAdmin();

  const porStatus = await Promise.all(
    CLIENTE_STATUSES.map(async (status) => {
      const { count, error } = await admin.from("totvs_clientes").select("id", { count: "exact", head: true }).eq("status", status);
      if (error) throw new Error(error.message);
      return { status, total: count ?? 0 };
    })
  );

  const statusComFaixa: ClienteStatus[] = ["ativo", "inativo"];
  const porFaixaDias = (
    await Promise.all(
      statusComFaixa.flatMap((status) =>
        FAIXAS_DIAS.map(async (faixa) => {
          let query = admin
            .from("totvs_clientes")
            .select("id", { count: "exact", head: true })
            .eq("status", status)
            .gte("days_without_buying", faixa.min);
          if (faixa.max !== null) query = query.lte("days_without_buying", faixa.max);
          const { count, error } = await query;
          if (error) throw new Error(error.message);
          return { status, faixa: faixa.label, total: count ?? 0 };
        })
      )
    )
  ).filter((f) => f.total > 0);

  return {
    porStatus,
    porFaixaDias,
    totalGeral: porStatus.reduce((sum, s) => sum + s.total, 0),
  };
}

export type ClienteListItem = {
  protheusCode: string;
  name: string;
  cpfCnpj: string;
  status: ClienteStatus;
  lastPurchaseDate: string | null;
  daysWithoutBuying: number | null;
  phone1: string | null;
  city: string | null;
  state: string | null;
};

export type ListClientesResult = {
  items: ClienteListItem[];
  total: number;
  page: number;
  pageSize: number;
};

const CLIENTES_PAGE_SIZE = 50;

export async function listClientes(
  opts: { q?: string; status?: ClienteStatus; page?: number } = {}
): Promise<ListClientesResult> {
  const admin = getSupabaseAdmin();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = CLIENTES_PAGE_SIZE;

  let query = admin
    .from("totvs_clientes")
    .select("protheus_code, name, cpf_cnpj, status, last_purchase_date, days_without_buying, phone1, address_city, address_state", {
      count: "exact",
    })
    .order("name");

  if (opts.status) query = query.eq("status", opts.status);

  const q = opts.q?.trim();
  if (q) {
    const qSafe = sanitizeOrFilterValue(q);
    query = query.or(`name.ilike.%${qSafe}%,phone1.ilike.%${qSafe}%,address_city.ilike.%${qSafe}%,cpf_cnpj.ilike.%${qSafe}%`);
  }

  query = query.range((page - 1) * pageSize, page * pageSize - 1);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  type Row = {
    protheus_code: string;
    name: string;
    cpf_cnpj: string;
    status: string;
    last_purchase_date: string | null;
    days_without_buying: number | null;
    phone1: string | null;
    address_city: string | null;
    address_state: string | null;
  };

  return {
    items: ((data ?? []) as unknown as Row[]).map((r) => ({
      protheusCode: r.protheus_code,
      name: r.name,
      cpfCnpj: r.cpf_cnpj,
      status: isClienteStatus(r.status) ? r.status : "nunca comprou",
      lastPurchaseDate: r.last_purchase_date,
      daysWithoutBuying: r.days_without_buying,
      phone1: r.phone1,
      city: r.address_city,
      state: r.address_state,
    })),
    total: count ?? 0,
    page,
    pageSize,
  };
}
