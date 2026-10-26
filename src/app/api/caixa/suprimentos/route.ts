import { NextRequest, NextResponse } from "next/server";
import { apiKeyValida } from "@/lib/logisticaApi";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  createSuprimentoPedido,
  listSuprimentoPedidosByStores,
  listSuprimentoProdutos,
  updateSuprimentoPedidoStatus,
  type NewSuprimentoPedidoItem,
} from "@/lib/suprimentos";

// 26/10/2026 (Pedro): a tela do CAIXA (painel atendimento.lojasmaia.com.br) ganhou a aba
// "Abastecimento e suprimentos" e pede os suprimentos daqui, em vez do gerente entrar no SAC.
// A ponte do painel chama esta rota com X-API-Key (CAIXA_API_KEYS) e o código da loja (stores.id = filial).
// A fila do CD (Rafael) continua em /assistencia/suprimentos/fila, sem mudança.

function naoAutorizado() {
  return NextResponse.json({ ok: false, erro: "X-API-Key ausente ou inválida." }, { status: 401 });
}

async function storeValida(store: string): Promise<{ id: string; name: string } | null> {
  const s = String(store || "").trim();
  if (!/^\d{3}$/.test(s)) return null;
  const admin = getSupabaseAdmin();
  const { data } = await admin.from("stores").select("id, name").eq("id", s).maybeSingle();
  return data ?? null;
}

export async function GET(req: NextRequest) {
  if (!apiKeyValida(req.headers.get("x-api-key"), process.env.CAIXA_API_KEYS)) return naoAutorizado();
  const store = await storeValida(req.nextUrl.searchParams.get("store") ?? "");
  if (!store) return NextResponse.json({ ok: false, erro: "Loja não cadastrada no SAC." }, { status: 400 });
  try {
    const [produtos, pedidos] = await Promise.all([listSuprimentoProdutos({ onlyActive: true }), listSuprimentoPedidosByStores([store.id])]);
    return NextResponse.json({ ok: true, loja: store, produtos, pedidos }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ ok: false, erro: (err as Error).message }, { status: 500 });
  }
}

type Body = {
  acao?: "criar" | "cancelar" | "recebido";
  store?: string;
  operador?: string;
  notes?: string | null;
  pedidoId?: string;
  note?: string;
  items?: { produtoId?: string | null; nomeLivre?: string | null; quantidade?: number; unidade?: string | null }[];
};

export async function POST(req: NextRequest) {
  if (!apiKeyValida(req.headers.get("x-api-key"), process.env.CAIXA_API_KEYS)) return naoAutorizado();
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, erro: "JSON inválido." }, { status: 400 });
  }
  const store = await storeValida(body.store ?? "");
  if (!store) return NextResponse.json({ ok: false, erro: "Loja não cadastrada no SAC." }, { status: 400 });
  const operador = String(body.operador || "").trim().slice(0, 80);
  if (!operador) return NextResponse.json({ ok: false, erro: "Informe o operador." }, { status: 400 });

  try {
    if (body.acao === "criar") {
      const items: NewSuprimentoPedidoItem[] = (body.items ?? [])
        .map((i) => ({
          produtoId: i.produtoId ? String(i.produtoId) : null,
          produtoNomeLivre: i.produtoId ? null : String(i.nomeLivre || "").trim().slice(0, 120) || null,
          quantidade: Math.max(1, Math.floor(Number(i.quantidade) || 0)),
          unidade: String(i.unidade || "").trim().slice(0, 20) || null,
        }))
        .filter((i) => i.produtoId || i.produtoNomeLivre);
      if (!items.length) return NextResponse.json({ ok: false, erro: "Coloque pelo menos um item." }, { status: 400 });
      const r = await createSuprimentoPedido({
        storeId: store.id,
        requestedByName: operador,
        requestedByRole: "caixa",
        notes: String(body.notes || "").trim().slice(0, 500) || null,
        items,
      });
      return NextResponse.json({ ok: true, pedido: r });
    }
    if (body.acao === "cancelar" || body.acao === "recebido") {
      const pedidos = await listSuprimentoPedidosByStores([store.id]);
      const p = pedidos.find((x) => x.id === body.pedidoId);
      if (!p) return NextResponse.json({ ok: false, erro: "Pedido não é desta loja." }, { status: 404 });
      if (body.acao === "cancelar") {
        if (p.status !== "solicitado") return NextResponse.json({ ok: false, erro: "Só dá para cancelar enquanto está 'solicitado'." }, { status: 409 });
        await updateSuprimentoPedidoStatus(p.id, { name: operador, role: "loja" }, p.status, "cancelado", { note: String(body.note || "").trim() || "cancelado pela loja (caixa)" });
      } else {
        if (p.status !== "enviado") return NextResponse.json({ ok: false, erro: "Só confirma recebimento quando o CD marcou 'enviado'." }, { status: 409 });
        await updateSuprimentoPedidoStatus(p.id, { name: operador, role: "loja" }, p.status, "recebido");
      }
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: false, erro: "acao deve ser criar | cancelar | recebido" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, erro: (err as Error).message }, { status: 500 });
  }
}
