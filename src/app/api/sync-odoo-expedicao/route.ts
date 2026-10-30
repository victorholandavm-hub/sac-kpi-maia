import { NextRequest, NextResponse } from "next/server";
import { sincronizarExpedicaoOdoo } from "@/lib/odooExpedicaoSync";
import { recordSyncRun } from "@/lib/syncRuns";
import { sincronizarVendasOdoo } from "@/lib/odooVendas";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { reconciliarEstoqueAt } from "@/lib/estoqueAt";

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
    // Vendas do dia pela ponte (odooVendas.ts) -- na mesma rodada, depois da expedição.
    const vendas = "skipped" in r ? null : await sincronizarVendasOdoo(getSupabaseAdmin()).catch((err) => ({ dias: [], vendas: 0, falhas: [(err as Error).message] }));
    if (vendas) await recordSyncRun("odoo-vendas", vendas.falhas.length < Math.max(1, vendas.dias.length), { dias: vendas.dias, vendas: vendas.vendas }, vendas.falhas);
    // Estoque AT das notificações de assistência (estoqueAt.ts) -- desligado até ESTOQUE_AT_AUTOMATICO=1.
    const estoqueAt = await reconciliarEstoqueAt().catch((err) => ({ acoes: 0, feitos: 0, semSaldo: 0, erros: [(err as Error).message] }));
    if ("acoes" in estoqueAt && estoqueAt.acoes) await recordSyncRun("estoque-at", !estoqueAt.erros.length, { acoes: estoqueAt.acoes, feitos: estoqueAt.feitos, semSaldo: estoqueAt.semSaldo }, estoqueAt.erros.slice(0, 20));
    return NextResponse.json({ ...r, vendas, estoqueAt });
  } catch (err) {
    await recordSyncRun("odoo-cargas", false, {}, [(err as Error).message]);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
