import { NextRequest, NextResponse } from "next/server";
import { sincronizarExpedicaoOdoo } from "@/lib/odooExpedicaoSync";

// Retrato da expedição do Odoo (odooExpedicaoSync.ts), cron próprio na VPS a
// cada 30 min (~/bin/odoo-expedicao-cron.sh). Passa pelo proxy porque começa
// com /api/sync.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await sincronizarExpedicaoOdoo());
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
