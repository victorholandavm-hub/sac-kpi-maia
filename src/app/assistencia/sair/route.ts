import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { ASSISTENCIA_TEAM_COOKIE_NAME } from "@/lib/assistenciaTeamAuth";
import { CAIXA_COOKIE_NAME } from "@/lib/caixaAuth";
import { CD_COOKIE_NAME } from "@/lib/cdAuth";
import { DRIVER_COOKIE_NAME } from "@/lib/driverAuth";
import { FABRICA_COOKIE_NAME } from "@/lib/fabricaAuth";
import { FINANCEIRO_COOKIE_NAME } from "@/lib/financeiroAuth";
import { LOJA_GERENTE_COOKIE_NAME } from "@/lib/lojaAuth";
import { MONTADOR_COOKIE_NAME } from "@/lib/montadorAuth";
import { TECNICO_COOKIE_NAME } from "@/lib/tecnicoAuth";

// Sai de todos os perfis de uma vez -- Victor 29/10/2026: "seja qual for o
// nível de acesso, precisa ter o botão de sair e, ao voltar à tela inicial de
// perfis, quando clicar em algum dos perfis para entrar, precisa pedir login
// novamente". Os cartões da tela de perfis passam por aqui (?para=<login>) e
// o botão Sair (BotaoSair) também. Cada cookie com o path em que foi gravado.

const SESSOES: { name: string; path: string }[] = [
  { name: CD_COOKIE_NAME, path: "/assistencia" },
  { name: CAIXA_COOKIE_NAME, path: "/assistencia" },
  { name: LOJA_GERENTE_COOKIE_NAME, path: "/assistencia" },
  { name: ASSISTENCIA_TEAM_COOKIE_NAME, path: "/assistencia" },
  { name: FABRICA_COOKIE_NAME, path: "/assistencia/encomendas" },
  { name: DRIVER_COOKIE_NAME, path: "/" },
  { name: FINANCEIRO_COOKIE_NAME, path: "/" },
  { name: MONTADOR_COOKIE_NAME, path: "/" },
  { name: TECNICO_COOKIE_NAME, path: "/" },
];

// Só caminho interno da assistência (nada de redirecionar pra fora).
function destino(para: string | null): string {
  return para && /^\/assistencia(\/[\w\-/]*)?$/.test(para) ? para : "/assistencia";
}

async function sair(req: NextRequest) {
  const store = await cookies();
  for (const s of SESSOES) store.delete(s);
  const supabase = await getSupabaseServer();
  await supabase.auth.signOut().catch(() => null);
  // Location relativa: req.url aqui dentro é o endereço interno (127.0.0.1).
  return new NextResponse(null, { status: 303, headers: { Location: destino(req.nextUrl.searchParams.get("para")), "Cache-Control": "no-store" } });
}

export const GET = sair;
export const POST = sair;
