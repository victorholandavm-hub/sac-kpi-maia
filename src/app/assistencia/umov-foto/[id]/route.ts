import { NextRequest, NextResponse } from "next/server";
import { getOptionalProfile } from "@/lib/dal";
import { getOperadorLogistica } from "@/lib/odoo/logisticaAuth";

// Foto antiga do uMov (acervo migrado, 08/02 a 22/09/2026) -- a ponte só
// entrega com a chave, então passa por aqui (consultaOdooPonte.ts).
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const profile = await getOptionalProfile();
  const pode = (profile && ["sac", "assistencia", "admin"].includes(profile.role)) || (await getOperadorLogistica());
  if (!pode) return new NextResponse("Sessão expirada.", { status: 401 });
  const { id } = await ctx.params;
  if (!/^[\w-]{1,64}$/.test(id)) return new NextResponse("Foto inválida.", { status: 400 });
  const base = (process.env.ODOO_BRIDGE_URL ?? "").replace(/\/+$/, "");
  const chave = process.env.ODOO_KEY_LOGISTICA;
  if (!base || !chave) return new NextResponse("Ponte não configurada.", { status: 500 });
  const r = await fetch(`${base}/umov/foto-legado/${id}`, {
    headers: { "X-Maia-Perfil": "logistica", "X-Maia-Key": chave },
    signal: AbortSignal.timeout(30_000),
    cache: "no-store",
  });
  if (!r.ok) return new NextResponse("Foto não encontrada.", { status: r.status === 404 ? 404 : 502 });
  return new NextResponse(r.body, {
    headers: { "Content-Type": r.headers.get("content-type") ?? "image/jpeg", "Cache-Control": "private, max-age=86400" },
  });
}
