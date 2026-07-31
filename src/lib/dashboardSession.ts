// Sessão simples de senha única para o painel de KPIs do SAC, baseada em cookie
// assinado (HMAC) em vez de HTTP Basic Auth — evita o diálogo nativo do navegador
// (e seus efeitos colaterais de cache/protection-space) e usa uma tela de login
// própria em /login.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const DASHBOARD_COOKIE_NAME = "dashboard_auth";

const TOKEN_MESSAGE = "dashboard-ok";

async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function computeDashboardToken(): Promise<string | null> {
  const secret = process.env.DASHBOARD_SESSION_SECRET;
  if (!secret) return null;
  return hmacHex(secret, TOKEN_MESSAGE);
}

// Checagem redundante à do proxy.ts (defesa em camadas): páginas totalmente
// estáticas podem, em certas condições de cache do Next.js, ser servidas sem
// passar pelo middleware — então páginas protegidas também conferem a sessão
// aqui, diretamente no server component.
export async function requireDashboardAuth(): Promise<void> {
  const expectedToken = await computeDashboardToken();
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(DASHBOARD_COOKIE_NAME)?.value;
  if (!expectedToken || sessionCookie !== expectedToken) {
    redirect("/login");
  }
}
