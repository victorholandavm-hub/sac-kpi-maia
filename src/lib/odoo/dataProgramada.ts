import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { EntregaOdoo } from "./logisticaTipos";

// Data programada escolhida na Expedição (odoo_data_programada, 0219) -- Victor
// 29/10/2026: a ponte devolve a "data de entrega" do pedido em vez da data da
// saída, então a reprogramação do Jhon "voltava". Mostra a data guardada até a
// ponte devolver a mesma; aí apaga a linha.
export function comDataProgramada<T extends Pick<EntregaOdoo, "picking_id" | "data_programada">>(
  saidas: T[],
  guardadas: Map<number, string>,
): { saidas: T[]; resolvidas: number[] } {
  const resolvidas: number[] = [];
  const out = saidas.map((e) => {
    const dia = guardadas.get(e.picking_id);
    if (!dia) return e;
    if ((e.data_programada || "").slice(0, 10) === dia) {
      resolvidas.push(e.picking_id);
      return e;
    }
    return { ...e, data_programada: dia };
  });
  return { saidas: out, resolvidas };
}

export async function aplicarDatasProgramadas<T extends Pick<EntregaOdoo, "picking_id" | "data_programada">>(saidas: T[]): Promise<T[]> {
  if (saidas.length === 0) return saidas;
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("odoo_data_programada").select("picking_id, dia").returns<{ picking_id: number; dia: string }[]>();
  if (error || !data?.length) return saidas;
  const { saidas: out, resolvidas } = comDataProgramada(saidas, new Map(data.map((d) => [d.picking_id, d.dia])));
  if (resolvidas.length) await admin.from("odoo_data_programada").delete().in("picking_id", resolvidas);
  return out;
}
