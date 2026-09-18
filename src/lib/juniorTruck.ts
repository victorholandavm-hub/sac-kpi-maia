import { getSupabaseAdmin } from "./supabaseAdmin";

// Log manual de horários do caminhão próprio da assistência (Junior) --
// pedido do Victor 18/09/2026, ver migration 0134_junior_truck_log.sql.
// Sem vínculo com chamado/pedido nenhum -- é controle do veículo em si.

export type JuniorTruckEntry = {
  id: string;
  logDate: string;
  loadingTime: string | null;
  departureTime: string | null;
  arrivalTime: string | null;
  unloadingTime: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

type JuniorTruckRow = {
  id: string;
  log_date: string;
  loading_time: string | null;
  departure_time: string | null;
  arrival_time: string | null;
  unloading_time: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

function toEntry(row: JuniorTruckRow): JuniorTruckEntry {
  return {
    id: row.id,
    logDate: row.log_date,
    loadingTime: row.loading_time,
    departureTime: row.departure_time,
    arrivalTime: row.arrival_time,
    unloadingTime: row.unloading_time,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Mais recentes primeiro, tanto por data quanto por hora de criação dentro
// do mesmo dia (mais de uma viagem no mesmo dia, a última entrada aparece
// em cima). Limite generoso (200) -- é um log manual, nunca vai crescer
// rápido o bastante pra precisar paginação de verdade.
export async function listJuniorTruckEntries(): Promise<JuniorTruckEntry[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("junior_truck_log")
    .select("*")
    .order("log_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return ((data ?? []) as JuniorTruckRow[]).map(toEntry);
}

export type JuniorTruckInput = {
  logDate: string;
  loadingTime: string | null;
  departureTime: string | null;
  arrivalTime: string | null;
  unloadingTime: string | null;
  notes: string | null;
};

export async function createJuniorTruckEntry(input: JuniorTruckInput, createdBy: string): Promise<JuniorTruckEntry> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("junior_truck_log")
    .insert({
      log_date: input.logDate,
      loading_time: input.loadingTime,
      departure_time: input.departureTime,
      arrival_time: input.arrivalTime,
      unloading_time: input.unloadingTime,
      notes: input.notes,
      created_by: createdBy,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return toEntry(data as JuniorTruckRow);
}

export async function updateJuniorTruckEntry(id: string, input: JuniorTruckInput): Promise<JuniorTruckEntry> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("junior_truck_log")
    .update({
      log_date: input.logDate,
      loading_time: input.loadingTime,
      departure_time: input.departureTime,
      arrival_time: input.arrivalTime,
      unloading_time: input.unloadingTime,
      notes: input.notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return toEntry(data as JuniorTruckRow);
}

export async function deleteJuniorTruckEntry(id: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("junior_truck_log").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
