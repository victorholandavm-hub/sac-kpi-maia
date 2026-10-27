import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { computeDashboardToken, DASHBOARD_COOKIE_NAME } from "@/lib/dashboardSession";

// 27/10/2026 (Pedro: "no dash de metas, em Acessos, tá pedindo minha credencial; queria que entrasse direto").
// Login único vindo do dash: o dash gera um token de uso único (60 s), assinado com HMAC-SHA256 (SSO_SECRET,
// mesmo valor nas duas pontas, só em variável de ambiente). Aqui: confere assinatura, validade e uso único,
// cria a sessão do MESMO jeito do login normal e manda para a tela pedida.
//  - destino /assistencia/... -> sessão Supabase do usuário (mesmo papel que ele tem em profiles)
//  - destino fora de /assistencia (painel de KPIs do SAC) -> cookie dashboard_auth, igual ao /login
// Token inválido/expirado/reusado -> tela de login normal com aviso simples.

export const dynamic = "force-dynamic";

type Payload = { u: string; d: string; exp: number; jti: string };

// uso único: jti guardado em memória até expirar (token vale 60 s; um processo por app)
const usados = new Map<string, number>();
function jaUsado(jti: string, exp: number): boolean {
  const agora = Date.now() / 1000;
  for (const [k, e] of usados) if (e < agora) usados.delete(k);
  if (usados.has(jti)) return true;
  usados.set(jti, exp + 5);
  return false;
}

function b64urlDecode(s: string): string {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function validar(t: string): Payload | null {
  const segredo = process.env.SSO_SECRET;
  if (!segredo || !t || t.length > 2000) return null;
  const [corpo, assinatura] = t.split(".");
  if (!corpo || !assinatura || !/^[0-9a-f]{64}$/.test(assinatura)) return null;
  const esperado = createHmac("sha256", segredo).update(corpo).digest();
  const recebido = Buffer.from(assinatura, "hex");
  if (recebido.length !== esperado.length || !timingSafeEqual(recebido, esperado)) return null;
  let p: Payload;
  try {
    p = JSON.parse(b64urlDecode(corpo));
  } catch {
    return null;
  }
  if (!p || typeof p.u !== "string" || typeof p.d !== "string" || typeof p.jti !== "string" || typeof p.exp !== "number") return null;
  const agora = Date.now() / 1000;
  if (p.exp < agora || p.exp > agora + 120) return null;
  if (!p.d.startsWith("/") || p.d.startsWith("//") || p.d.includes("\\")) return null;
  if (jaUsado(p.jti, p.exp)) return null;
  return p;
}

// endereço PÚBLICO fixo (atrás do nginx o req.nextUrl vem como localhost:300x; não confiar no Host recebido)
function base(): string {
  return process.env.ASSISTENCIA_ONLY_PROJECT ? "https://assistencia.lojasmaia.com.br" : "https://sac.lojasmaia.com.br";
}

function paraLogin(_req: NextRequest, assistencia: boolean) {
  return NextResponse.redirect(base() + (assistencia ? "/assistencia/login" : "/login") + "?sso=expirado", 303);
}

export async function GET(req: NextRequest) {
  const t = req.nextUrl.searchParams.get("t") || "";
  const somenteAssistencia = !!process.env.ASSISTENCIA_ONLY_PROJECT;
  const p = validar(t);
  if (!p) return paraLogin(req, somenteAssistencia);
  const assistencia = p.d.startsWith("/assistencia");
  const destino = base() + p.d;

  if (assistencia) {
    try {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: p.u });
      const hashed = data?.properties?.hashed_token;
      if (error || !hashed) return paraLogin(req, true);
      const supabase = await getSupabaseServer();
      const { error: e2 } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: hashed });
      if (e2) return paraLogin(req, true);
    } catch (e) {
      console.error("[sso]", e);
      return paraLogin(req, true);
    }
    console.log("[sso] entrou %s -> %s", p.u, p.d);
    return NextResponse.redirect(destino, 303);
  }

  const token = await computeDashboardToken();
  if (!token) return paraLogin(req, false);
  const store = await cookies();
  store.set(DASHBOARD_COOKIE_NAME, token, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 30, path: "/" });
  console.log("[sso] painel SAC %s -> %s", p.u, p.d);
  return NextResponse.redirect(destino, 303);
}
