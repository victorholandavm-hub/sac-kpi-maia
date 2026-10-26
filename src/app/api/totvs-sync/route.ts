import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { runTotvsSync } from "@/lib/totvsSync";
import { expirarVouchers } from "@/lib/vouchers";
import { sincronizarExpedicaoOdoo } from "@/lib/odooExpedicaoSync";

// Histórico: não estava no cron do Vercel (vercel.json) porque o firewall do
// Protheus derrubava (timeout) o IP de nuvem do Vercel -- o sync real rodava
// via scripts/totvs-sync.ts, agendado numa máquina dentro da rede liberada,
// e esta rota ficava só pra disparo/teste manual local.
//
// Achado do Victor 12/09/2026: essa restrição não vale mais pra VPS -- o
// disparador externo (nunca identificado, fora deste repositório) ficou
// 14h+ sem chamar essa rota sem ninguém perceber, e testando um disparo
// manual DIRETO DA VPS (não mais do computador de casa/CD) o sync rodou
// normal, sem timeout, e fechou 9 dias de atraso de uma vez. Por isso essa
// rota entrou no sync-cron.yml (GitHub Actions, a cada ~2-3h) como rede de
// segurança visível/monitorável -- não depende mais só do disparador
// externo sozinho (que pode continuar existindo, rodando mais frequente).
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  // Comparação direta com `Bearer ${process.env.CRON_SECRET}` deixava a
  // rota aberta pra quem mandasse literalmente "Bearer undefined" caso a
  // variável de ambiente sumisse num deploy -- falha aberta, não fechada.
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    // Trava ocupada também sai com 200 ({ skipped: "em_execucao", ... }), para
    // não marcar falha no GitHub Actions a cada sobreposição.
    // Vouchers vencidos viram "expirado" aqui (cron da VPS, a cada 30 min).
    // A baixa já recusa vencido sozinha: falha aqui não derruba o sync.
    const vouchersExpirados = await expirarVouchers().catch(() => null);
    // Expedição do Odoo (odooExpedicaoSync.ts): ponte do Pedro, não o
    // Protheus -- roda junto e falha sem derrubar o sync.
    const [summary, expedicaoOdoo] = await Promise.all([
      runTotvsSync(getSupabaseAdmin(), "rota"),
      sincronizarExpedicaoOdoo().catch((err: Error) => ({ erro: err.message })),
    ]);
    return NextResponse.json({ ...summary, vouchersExpirados, expedicaoOdoo });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
