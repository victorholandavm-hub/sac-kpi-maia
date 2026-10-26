import { NextRequest, NextResponse } from "next/server";
import { getOperadorLogistica } from "@/lib/odoo/logisticaAuth";
import { mensagemDeErro, progressoCarga } from "@/lib/odoo/logistica";

// 26/10 (Pedro: "a animação tá bugando"): o progresso do "Sair em rota" era lido por server action, e o Next
// enfileira as actions do mesmo navegador atrás da do faturamento -- a tela só atualizava no fim.
// Aqui é um GET comum, que roda em paralelo ao faturamento. Mesmo login do CD.
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const op = await getOperadorLogistica();
  if (!op) return NextResponse.json({ ok: false, erro: "Sessão do CD expirada." }, { status: 401 });
  const { id } = await params;
  const n = Number(id);
  if (!(n > 0)) return NextResponse.json({ ok: false, erro: "carga inválida" }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, dados: await progressoCarga(n) }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ ok: false, erro: mensagemDeErro(err) }, { status: 502 });
  }
}
