import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { runTotvsSync } from "@/lib/totvsSync";

// Não está mais no cron do Vercel (vercel.json) -- o firewall do Protheus
// derruba (timeout) o IP de nuvem do Vercel, então o sync real roda via
// scripts/totvs-sync.ts, agendado numa máquina dentro da rede liberada. Esta
// rota fica só pra disparo/teste manual local (npm run dev), onde o IP de
// origem já é o da rede liberada.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  // Comparação direta com `Bearer ${process.env.CRON_SECRET}` deixava a
  // rota aberta pra quem mandasse literalmente "Bearer undefined" caso a
  // variável de ambiente sumisse num deploy -- falha aberta, não fechada.
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const summary = await runTotvsSync(getSupabaseAdmin());
    return NextResponse.json(summary);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
