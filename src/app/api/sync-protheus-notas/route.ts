import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { comTrava } from "@/lib/travaSync";
import { copiarNotasDeEntrega } from "@/lib/notaEntregaProtheus";

// Cópia de madrugada das notas de entrega do Protheus (notaEntregaProtheus.ts)
// -- cron da VPS de hora em hora entre 02h e 05h de Recife. Cada rodada anda
// até 50 min, um dia de entregas por vez. Passa pelo proxy (/api/sync…).
export const dynamic = "force-dynamic";
export const maxDuration = 3600;

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await comTrava(getSupabaseAdmin(), "protheus_notas", "cron", 60 * 60, () => copiarNotasDeEntrega(50 * 60_000)));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
