import { NextRequest, NextResponse } from "next/server";
import { SUBCONTAS, sincronizarSubconta, type SubcontaKey } from "@/lib/ghlSubcontas";

export const maxDuration = 290;

// Mesma autenticação de /api/sync (cron do GitHub Actions) -- falha fechada se
// CRON_SECRET não existir.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const resultados: Record<string, unknown> = {};
  for (const key of Object.keys(SUBCONTAS) as SubcontaKey[]) {
    try {
      resultados[key] = { ok: true, ...(await sincronizarSubconta(key)) };
    } catch (err) {
      resultados[key] = { ok: false, error: (err as Error).message.slice(0, 300) };
    }
  }
  return NextResponse.json({ ok: true, resultados });
}
