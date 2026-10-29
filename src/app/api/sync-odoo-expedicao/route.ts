import { NextRequest, NextResponse } from "next/server";
import { sincronizarExpedicaoOdoo } from "@/lib/odooExpedicaoSync";
import { recordSyncRun } from "@/lib/syncRuns";

// Retrato da expedição do Odoo (odooExpedicaoSync.ts), cron próprio na VPS a
// cada 30 min (~/bin/odoo-expedicao-cron.sh). Passa pelo proxy porque começa
// com /api/sync.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const r = await sincronizarExpedicaoOdoo();
    // A hora "dados das HH:MM" dos KPIs de logística vem daqui (29/10/2026).
    if (!("skipped" in r)) await recordSyncRun("odoo-cargas", r.falhas.length < r.empresas, { ...r, falhas: r.falhas.length }, r.falhas.map((f) => `${f.empresa}: ${f.erro}`).slice(0, 20));
    return NextResponse.json(r);
  } catch (err) {
    await recordSyncRun("odoo-cargas", false, {}, [(err as Error).message]);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
