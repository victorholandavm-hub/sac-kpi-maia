import { NextRequest, NextResponse } from "next/server";
import { copiarNotasDeEntrega } from "@/lib/notaEntregaProtheus";

// Cópia de madrugada das notas de entrega do Protheus (notaEntregaProtheus.ts)
// -- cron da VPS de hora em hora entre 02h e 05h de Recife (flock no script).
// Cada rodada anda até ?minutos= (padrão e máximo 50), um dia por vez. Passa
// pelo proxy (/api/sync…).
//
// Sem a trava sync_locks de propósito: o publicar.sh espera ela ficar livre
// antes de trocar o sac e desiste em 10 min -- uma rodada longa derrubaria as
// publicações (inclusive a --atrasados da noite). Aqui basta não rodar duas ao
// mesmo tempo no mesmo processo; o flock do cron cobre o resto.
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
    return NextResponse.json(await copiarNotasDeEntrega(minutos * 60_000));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  } finally {
    rodando = false;
  }
}
