import { getSupabaseAdmin } from "./supabaseAdmin";

export type NpsWeekPoint = {
  weekStart: string; // YYYY-MM-DD, segunda-feira da semana
  avgScore: number | null;
  npsIndex: number | null;
  responseCount: number;
};

// Segunda-feira da semana de `date` -- mesmo critério de startOfRotaWeek em
// rotas.ts, reescrito aqui pra não acoplar o painel de KPIs (app "sac", sem
// nada de rota/motorista) a um módulo que é só da Assistência.
function startOfWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const daysSinceMonday = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - daysSinceMonday);
  return d.toISOString().slice(0, 10);
}

// Evolução do NPS (página /avaliacoes) -- só nps_score/nps_answered_at de
// `conversations`, igual à segunda varredura
// de getKpiData (kpi.ts), mas sem buscar a base inteira de chamados (que
// só serve pra calcular taxa de resposta, não pro índice em si) -- refazer
// isso pra cada semana do período saía caro demais só pra uma linha do
// tempo. Mesma fórmula de buildNpsSummary: promotor 4-5, neutro 3,
// detrator 1-2, índice = %promotor - %detrator.
export async function getNpsTrend(weeksBack: number): Promise<NpsWeekPoint[]> {
  const admin = getSupabaseAdmin();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - weeksBack * 7);

  const scores: { score: number; answeredAt: string }[] = [];
  const pageSize = 1000;
  for (let page = 0; ; page++) {
    const { data, error } = await admin
      .from("conversations")
      .select("nps_score, nps_answered_at")
      .not("nps_score", "is", null)
      .gte("nps_answered_at", since.toISOString())
      .range(page * pageSize, page * pageSize + pageSize - 1);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      if (row.nps_answered_at) scores.push({ score: row.nps_score as number, answeredAt: row.nps_answered_at as string });
    }
    if (!data || data.length < pageSize) break;
  }

  const byWeek = new Map<string, number[]>();
  for (const { score, answeredAt } of scores) {
    const week = startOfWeek(new Date(answeredAt));
    const list = byWeek.get(week) ?? [];
    list.push(score);
    byWeek.set(week, list);
  }

  return [...byWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, weekScores]) => {
      const avgScore = Math.round((weekScores.reduce((a, b) => a + b, 0) / weekScores.length) * 10) / 10;
      const promoterPct = (weekScores.filter((s) => s >= 4).length / weekScores.length) * 100;
      const detractorPct = (weekScores.filter((s) => s <= 2).length / weekScores.length) * 100;
      return {
        weekStart,
        avgScore,
        npsIndex: Math.round(promoterPct - detractorPct),
        responseCount: weekScores.length,
      };
    });
}
