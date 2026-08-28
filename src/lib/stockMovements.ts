import { getSupabaseAdmin } from "./supabaseAdmin";
import { sanitizeOrFilterValue } from "./searchFilter";

export type MovementType = "retirado" | "devolvido" | "reparado";

export const MOVEMENT_TYPES: MovementType[] = ["retirado", "devolvido", "reparado"];

export function isMovementType(value: string | undefined | null): value is MovementType {
  return !!value && (MOVEMENT_TYPES as string[]).includes(value);
}

export type StockMovement = {
  id: string;
  movementType: MovementType;
  code: string | null;
  product: string;
  factory: string | null;
  clientName: string | null;
  volume: string | null;
  responsible: string | null;
  movementDate: string | null;
  loggedDate: string | null;
  notes: string | null;
  createdAt: string;
  // Quem da equipe técnica confirmou a retirada física -- pedido do
  // Victor 28/08/2026: "Assistencia registra e a equipe tecnica é que
  // retira do estoque e lança a data que foi retirada" (ver
  // withdrawStockMovement em estoque-actions.ts). Só preenchido depois
  // da baixa -- não confundir com `responsible` (quem REGISTROU,
  // preenchido na criação, sempre assistência/admin).
  withdrawnBy: string | null;
};

type StockMovementRow = {
  id: string;
  movement_type: MovementType;
  code: string | null;
  product: string;
  factory: string | null;
  client_name: string | null;
  volume: string | null;
  responsible: string | null;
  movement_date: string | null;
  logged_date: string | null;
  notes: string | null;
  created_at: string;
  withdrawn_by: string | null;
};

const COLUMNS =
  "id, movement_type, code, product, factory, client_name, volume, responsible, movement_date, logged_date, notes, created_at, withdrawn_by";

function toStockMovement(row: StockMovementRow): StockMovement {
  return {
    id: row.id,
    movementType: row.movement_type,
    code: row.code,
    product: row.product,
    factory: row.factory,
    clientName: row.client_name,
    volume: row.volume,
    responsible: row.responsible,
    movementDate: row.movement_date,
    loggedDate: row.logged_date,
    notes: row.notes,
    createdAt: row.created_at,
    withdrawnBy: row.withdrawn_by,
  };
}

// "Pendente de retirada" -- só faz sentido pra movement_type='retirado'
// (é o único tipo com a etapa separada de baixa pela equipe técnica, ver
// migration 0102): registrado por assistência sem `movement_date` ainda
// (a equipe técnica não confirmou a retirada física). Devolvido/reparado
// continuam de etapa única, sem essa noção de pendência.
export function isPendingWithdrawal(m: Pick<StockMovement, "movementType" | "movementDate">): boolean {
  return m.movementType === "retirado" && !m.movementDate;
}

export async function listStockMovements(
  opts: { movementType?: MovementType; q?: string; onlyPendingWithdrawal?: boolean } = {}
): Promise<StockMovement[]> {
  const admin = getSupabaseAdmin();
  let query = admin.from("stock_movements").select(COLUMNS).order("created_at", { ascending: false });

  if (opts.movementType) {
    query = query.eq("movement_type", opts.movementType);
  }
  if (opts.onlyPendingWithdrawal) {
    query = query.eq("movement_type", "retirado").is("movement_date", null);
  }

  const q = opts.q?.trim();
  if (q) {
    const qSafe = sanitizeOrFilterValue(q);
    query = query.or([`product.ilike.%${qSafe}%`, `code.ilike.%${qSafe}%`, `client_name.ilike.%${qSafe}%`].join(","));
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as StockMovementRow[]).map(toStockMovement);
}
