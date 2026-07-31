import { NextRequest, NextResponse } from "next/server";
import { computeDashboardToken, DASHBOARD_COOKIE_NAME } from "@/lib/dashboardSession";

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Este projeto Vercel (o painel de KPIs do SAC) não hospeda mais o módulo de
  // assistência — ele mora em um projeto/domínio separado. Se ASSISTENCIA_REDIRECT_URL
  // estiver definida (só neste projeto, nunca no projeto da assistência), qualquer
  // acesso a /assistencia aqui é redirecionado para lá, em vez de servir a rota local.
  if (pathname.startsWith("/assistencia") && process.env.ASSISTENCIA_REDIRECT_URL) {
    return NextResponse.redirect(`${process.env.ASSISTENCIA_REDIRECT_URL}${pathname}${search}`, 308);
  }

  // Este projeto Vercel é exclusivo do módulo de assistência (não tem o painel de
  // KPIs do SAC). Sem isso, qualquer acesso fora de /assistencia (a raiz do domínio,
  // um link digitado sem o caminho completo, etc.) cairia na checagem de senha do
  // painel do SAC logo abaixo — que nem existe aqui — confundindo quem acessa.
  if (!pathname.startsWith("/assistencia") && process.env.ASSISTENCIA_ONLY_PROJECT) {
    const assistenciaUrl = req.nextUrl.clone();
    assistenciaUrl.pathname = "/assistencia";
    return NextResponse.redirect(assistenciaUrl, 307);
  }

  // Todo o módulo de assistência (tela inicial, área da loja, formulário de
  // solicitação) é público, sem senha nenhuma. A única autenticação real é o login
  // individual da equipe assistência (Supabase Auth), verificado dentro da
  // aplicação ao entrar em "Equipe assistência" (ver src/lib/dal.ts) — não aqui.
  if (pathname.startsWith("/assistencia")) {
    return NextResponse.next();
  }

  // Página de login própria do painel do SAC — sempre acessível, senão ninguém
  // conseguiria entrar.
  if (pathname === "/login") {
    return NextResponse.next();
  }

  // Painel de KPIs do SAC: login com sessão em cookie assinado (troca do Basic Auth
  // do navegador, que ficava sujeito a comportamentos estranhos de cache/protection
  // space entre diferentes domínios/dispositivos).
  const expectedToken = await computeDashboardToken();
  const sessionCookie = req.cookies.get(DASHBOARD_COOKIE_NAME)?.value;
  if (expectedToken && sessionCookie === expectedToken) {
    return NextResponse.next();
  }
  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/login";
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!api/ghl-webhook|api/sync|api/backup|api/totvs-sync|_next/static|_next/image|favicon.ico|logo.png).*)"],
};
