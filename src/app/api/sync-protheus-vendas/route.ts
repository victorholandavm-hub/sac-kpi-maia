import { NextRequest, NextResponse } from "next/server";
import { completarVendasProtheus } from "@/lib/completarVendasProtheus";

// Completa as vendas do Protheus que faltam (completarVendasProtheus.ts) --
// cron de madrugada; ?minutos= (padrão e máximo 50). Sem a trava sync_locks
// pelo mesmo motivo de /api/sync-protheus-notas (não segurar publicações).
export const dynamic = "force-dynamic";
export const maxDuration = 3600;

let rodando = false;

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (rodando) return NextResponse.json({ skipped: "em_execucao" });
  const minutos = Math.min(Math.max(Number(req.nextUrl.searchParams.get("minutos")) || 50, 1), 50);
  rodando = true;
  try {
    return NextResponse.json(await completarVendasProtheus(minutos * 60_000));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  } finally {
    rodando = false;
  }
}
