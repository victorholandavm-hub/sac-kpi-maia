import { NextRequest, NextResponse } from "next/server";

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

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Formulário público de solicitação de assistência: sem login individual, só uma
  // senha única compartilhada entre as lojas (evita deixar o link totalmente aberto).
  if (pathname.startsWith("/assistencia/solicitar")) {
    return checkBasicAuth(
      req,
      process.env.LOJA_REQUEST_USER,
      process.env.LOJA_REQUEST_PASSWORD,
      "Solicitação de assistência"
    );
  }

  // Demais rotas de /assistencia (login, fila, detalhe) usam Supabase Auth próprio,
  // verificado dentro da aplicação (ver src/lib/dal.ts) — não passam pelo Basic Auth.
  if (pathname.startsWith("/assistencia")) {
    return NextResponse.next();
  }

  // Painel de KPIs do SAC: Basic Auth único, como já era.
  return checkBasicAuth(req, process.env.DASHBOARD_USER, process.env.DASHBOARD_PASSWORD, "Painel SAC Maia");
}

export const config = {
  matcher: ["/((?!api/ghl-webhook|api/sync|_next/static|_next/image|favicon.ico).*)"],
};
