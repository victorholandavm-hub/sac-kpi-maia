import { getSupabaseAdmin } from "./supabaseAdmin";

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
};

const COLUMNS =
  "id, movement_type, code, product, factory, client_name, volume, responsible, movement_date, logged_date, notes, created_at";

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
  };
}

export async function listStockMovements(
  opts: { movementType?: MovementType; q?: string } = {}
): Promise<StockMovement[]> {
  const admin = getSupabaseAdmin();
  let query = admin.from("stock_movements").select(COLUMNS).order("created_at", { ascending: false });

  if (opts.movementType) {
    query = query.eq("movement_type", opts.movementType);
  }

  const q = opts.q?.trim();
  if (q) {
    query = query.or([`product.ilike.%${q}%`, `code.ilike.%${q}%`, `client_name.ilike.%${q}%`].join(","));
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as StockMovementRow[]).map(toStockMovement);
}
