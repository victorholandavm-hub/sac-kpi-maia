import { NextRequest, NextResponse } from "next/server";
import { listCronogramaAtrasosNaoAlertados, recordCronogramaAlertaEnviado } from "@/lib/cronogramaSac";
import { notifyTelegramCronogramaAtraso } from "@/lib/telegram";
import { recordSyncRun } from "@/lib/syncRuns";

// Alerta automático de atraso do Cronograma Diário do SAC -- pedido do
// Victor 01/10/2026. Chamado a cada 15min por
// .github/workflows/sac-cronograma-cron.yml (mesmo padrão de /api/sync,
// /api/totvs-sync etc. -- Authorization: Bearer CRON_SECRET). 15min (não
// os mesmos 2h do resto do sync) porque o item mais próximo do cronograma
// tem só 30min de intervalo pro próximo (08:00 -> 08:30) -- um atraso
// precisa ser pego bem antes disso pra avisar "na hora" de verdade.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const pendentes = await listCronogramaAtrasosNaoAlertados();
    let sent = 0;
    const errors: string[] = [];
    for (const p of pendentes) {
      try {
        await notifyTelegramCronogramaAtraso({ atendenteName: p.fullName, horario: p.horario, descricao: p.descricao });
        await recordCronogramaAlertaEnviado(p.itemId, p.profileId);
        sent++;
      } catch (err) {
        // Um erro isolado (ex.: falha ao gravar o alerta de UM item) não
        // pode travar o resto do lote -- cada atendente/item é
        // independente dos outros.
        errors.push(`${p.fullName} / ${p.descricao}: ${(err as Error).message}`);
      }
    }
    const ok = errors.length === 0;
    await recordSyncRun("sac-cronograma-check", ok, { pendentes: pendentes.length, sent }, errors);
    return NextResponse.json({ ok, pendentes: pendentes.length, sent, errors });
  } catch (err) {
    const message = (err as Error).message;
    await recordSyncRun("sac-cronograma-check", false, {}, [message]);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
