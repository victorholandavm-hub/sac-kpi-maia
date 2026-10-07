import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { apiKeyValida, parsePeriodoKpis } from "@/lib/logisticaApi";

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

  const { de, ate, tipo } = parsed.periodo;
  const { data, error } = await getSupabaseAdmin().rpc("kpis_logistica", {
    p_de: de,
    p_ate: ate,
    p_tipo: tipo,
  });
  if (error) {
    console.error("[logistica/kpis] erro na RPC kpis_logistica:", error.message);
    return NextResponse.json({ erro: "erro_interno", mensagem: "Falha ao calcular os KPIs." }, { status: 500 });
  }

  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
