import { NextRequest, NextResponse } from "next/server";
import { apiKeyValida, parsePeriodoKpis } from "@/lib/logisticaApi";
import { getKpisLogistica } from "@/lib/kpisLogistica";

// Tela de KPIs logísticos: uma chamada à RPC kpis_logistica (migração 0157),
// que lê só do Supabase -- nunca do Protheus. Definições em
// lojas-maia-integracao/apis/logistica-v1/kpis-logistica.md.
export async function GET(req: NextRequest) {
  if (!apiKeyValida(req.headers.get("x-api-key"), process.env.LOGISTICA_API_KEYS)) {
    return NextResponse.json(
      { erro: "nao_autorizado", mensagem: "X-API-Key ausente ou inválida." },
      { status: 401 },
    );
  }

  const parsed = parsePeriodoKpis(req.nextUrl.searchParams);
  if (!parsed.ok) {
    return NextResponse.json(parsed.erro, { status: 400 });
  }

  let data;
  try {
    data = await getKpisLogistica(parsed.periodo);
  } catch (err) {
    console.error("[logistica/kpis]", (err as Error).message);
    return NextResponse.json({ erro: "erro_interno", mensagem: "Falha ao calcular os KPIs." }, { status: 500 });
  }

  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
