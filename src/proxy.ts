import { NextRequest, NextResponse } from "next/server";
import { computeDashboardToken, DASHBOARD_COOKIE_NAME } from "@/lib/dashboardSession";

function checkBasicAuth(req: NextRequest, expectedUser: string | undefined, expectedPassword: string | undefined, realm: string) {
  const header = req.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    const decoded = atob(header.slice(6));
    const separatorIndex = decoded.indexOf(":");
    const user = decoded.slice(0, separatorIndex);
    const password = decoded.slice(separatorIndex + 1);
    if (expectedUser && expectedPassword && user === expectedUser && password === expectedPassword) {
      return NextResponse.next();
    }
  }

  return new NextResponse("Autenticação necessária.", {
    status: 401,
    headers: { "WWW-Authenticate": `Basic realm="${realm}"` },
  });
}

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
    return NextResponse.redirect(new URL("/assistencia", req.url), 307);
  }

  // Área da loja (painel de demanda em aberto + formulário): sem login individual, só uma
  // senha única compartilhada entre as lojas (evita deixar o link totalmente aberto).
  if (pathname.startsWith("/assistencia/solicitar") || pathname.startsWith("/assistencia/loja")) {
    return checkBasicAuth(
      req,
      process.env.LOJA_REQUEST_USER,
      process.env.LOJA_REQUEST_PASSWORD,
      "Solicitação de assistência"
    );
  }

  // Tela inicial pública (escolher "gerente de loja" ou "equipe assistência") e demais
  // rotas de /assistencia (login, fila, detalhe) usam Supabase Auth próprio, verificado
  // dentro da aplicação (ver src/lib/dal.ts) — não passam pelo Basic Auth.
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
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  matcher: ["/((?!api/ghl-webhook|api/sync|_next/static|_next/image|favicon.ico|logo.png).*)"],
};
