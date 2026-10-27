import { NextRequest, NextResponse } from "next/server";
import { computeDashboardToken, DASHBOARD_COOKIE_NAME } from "@/lib/dashboardSession";

// Rotas que precisam passar direto, sem cair em nenhum redirect de auth
// abaixo (webhooks/sync externos, assets estáticos, upload de foto). Isso
// substitui o antigo `config.matcher` com regex "tudo menos X" -- aquele
// idioma não cobria a raiz do domínio ("/") de jeito nenhum, nem mesmo
// com "/" adicionado explicitamente como item à parte no array (bug
// confirmado direto em produção, comparando comportamento com/sem matcher).
// Checagem simples de string aqui, sem depender de regex/matcher do Next.
const PASSTHROUGH_PREFIXES = [
  "/api/ghl-webhook",
  "/api/sync",
  "/api/backup",
  "/api/totvs-sync",
  // Reconciliação periódica de tags do GHL (ver tagReconciliation.ts) --
  // mesmo motivo dos outros crons acima: não começa com /api/sync, cairia
  // no redirect de auth do painel de KPIs sem isso (mesma classe de bug já
  // pega em /api/assistencia/log-print, 16/09/2026 -- aprendida a lição
  // dessa vez, adicionado já na criação da rota).
  "/api/reconcile-tags",
  // Alerta de atraso do Cronograma Diário do SAC (ver
  // .github/workflows/sac-cronograma-cron.yml) -- mesmo motivo exato de
  // /api/reconcile-tags acima: não começa com /api/sync nem /assistencia,
  // caiu direto no redirect de auth do painel de KPIs (confirmado em
  // produção 01/10/2026 -- curl na rota devolvia 307 pra /login em vez de
  // rodar o GET, então o cron de 15min nunca executava nada de verdade).
  "/api/sac-cronograma-check",
  "/api/montador/upload-photo",
  "/api/motorista/upload-photo",
  // Upload do comprovante de estorno pelo financeiro -- mesmo motivo dos
  // dois acima (POST comum em vez de Server Action).
  "/api/financeiro/upload-comprovante",
  // Upload de foto pela equipe (assistência/admin/SAC) na tela de detalhe
  // do chamado -- mesmo motivo dos dois acima (POST comum em vez de Server
  // Action, ver route.ts), precisa do mesmo passthrough: não começa com
  // /assistencia, então cairia no gate de auth do painel de KPIs do SAC (ou
  // no redirect pra /assistencia) sem isso.
  "/api/staff/upload-photo",
  // Log de impressão da notificação de assistência (ver PrintButton.tsx) --
  // mesmo motivo dos três acima (POST comum em vez de Server Action):
  // não começa com /assistencia, então caía nesse mesmo redirect pra
  // /assistencia (achado 16/09/2026 verificando o deploy da correção do
  // botão de imprimir -- o fetch falhava silenciosamente, `.catch(()=>{})`
  // não deixava travar o `window.print()`, mas o evento "printed" nunca
  // era gravado).
  "/api/assistencia/log-print",
  // Serve foto do disco local (ver src/lib/localPhotoStorage.ts) -- não
  // começa com /assistencia, então sem isso caía no gate de auth do painel
  // de KPIs do SAC (ou no redirect pra /assistencia no projeto exclusivo da
  // assistência), quebrando toda foto de chamado (achado 20/08/2026, na
  // verificação pós-deploy dessa mesma mudança -- nenhum usuário chegou a
  // ver quebrado). Sem checagem de sessão própria de propósito -- a
  // "autenticação" é o caminho em si (contém um UUID de 128 bits, não
  // adivinhável), mesmo nível de proteção que a URL assinada do Supabase
  // Storage que essa rota substituiu.
  "/api/photos",
  "/api/avaliar",
  // API de logística (X-API-Key própria, ver src/lib/logisticaApi.ts): sem
  // isso cairia no redirect de login do painel, como os crons acima.
  "/api/logistica/v1",
  // NPS por vendedor pro app de vendas do Pedro (X-API-Key própria, ver
  // api/vendas/v1/nps-vendedores/route.ts) -- mesmo motivo da linha acima.
  "/api/vendas/v1",
  // 27/10 (Pedro, caixas sem material de consumo): pedido de suprimentos do caixa das lojas (X-API-Key
  // própria CAIXA_API_KEYS, ver api/caixa/suprimentos/route.ts) -- sem isso caía no redirect de login (307). Publicado 27/10.
  "/api/caixa/suprimentos",
  // Resumo de estornos por loja (ver route.ts) -- pedido do Gabriel/
  // financeiro 14/10/2026, só existe de verdade na instância embutida
  // (ESTORNO_EMBED), mas o passthrough fica disponível sempre, mesmo
  // padrão dos outros acima.
  "/api/estornos/resumo",
  // Reprocessamento único do backlog do NPS Compra (ver
  // api/admin/reprocess-compra-nps/route.ts) -- mesmo motivo dos crons
  // acima: não começa com /api/sync nem /assistencia, cairia no redirect
  // de auth do painel de KPIs sem isso.
  "/api/admin/reprocess-compra-nps",
  "/_next/static",
  "/_next/image",
  "/favicon.ico",
  "/icon.png",
  "/logo.png",
];

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (PASSTHROUGH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  // Instância embutida (ESTORNO_EMBED) -- pedido do Gabriel/financeiro
  // 14/10/2026: essa 5ª instância PM2 (mesmo código, mesmo Supabase das
  // outras 4) é aberta dentro de um iframe cross-site no portal de
  // conciliação da AIAM, então só deve servir estornos/financeiro (defesa
  // em profundidade -- é alcançável por outra equipe, mesmo reusando este
  // código todo) e precisa liberar frame-ancestors pra essa origem. Nunca
  // roda nas 4 instâncias de produção normais (env var ausente lá).
  if (process.env.ESTORNO_EMBED) {
    const allowedPrefixes = ["/assistencia/estornos", "/assistencia/financeiro"];
    if (!allowedPrefixes.some((prefix) => pathname.startsWith(prefix))) {
      const estornosUrl = req.nextUrl.clone();
      estornosUrl.pathname = "/assistencia/estornos";
      estornosUrl.search = "";
      return NextResponse.redirect(estornosUrl, 307);
    }
    const response = NextResponse.next();
    const allowedOrigin = process.env.ESTORNO_EMBED_ALLOWED_ORIGIN;
    if (allowedOrigin) response.headers.set("Content-Security-Policy", `frame-ancestors 'self' ${allowedOrigin}`);
    return response;
  }

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

// Sem `config.matcher` de propósito (ver PASSTHROUGH_PREFIXES acima) --
// proxy roda em toda requisição, comportamento padrão do Next sem matcher.
