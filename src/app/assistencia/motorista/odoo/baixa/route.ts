import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getMotoristaSessao } from "@/lib/odoo/logisticaAuth";
import { registrarBaixaParada, type EntradaBaixa } from "@/lib/odoo/baixaParada";
import { STATUS_DA_FALHA } from "@/lib/odoo/baixaIdempotencia";

// Baixa da parada do Odoo por POST comum (JSON) -- usada pela fila offline
// da PWA (src/lib/pwa/filaBaixas.ts na página e public/assistencia/sw.js no
// Background Sync). Service worker não chama Server Action, por isso a rota.
// Mora sob /assistencia pelo mesmo motivo da rota da foto (proxy.ts deixa
// passar; a sessão do motorista é conferida aqui, cookie driver_session).
//
// Contrato de status (o celular decide pelo status, não pelo texto):
//   200 {ok:true,dados}  enviado -> sai da fila
//   409 ja_registrada    a parada já tinha resultado -> sai da fila, avisa
//   401 sessao           fica na fila até o motorista entrar de novo
//   422 recusada         fica na fila marcada com erro (motorista vê/decide)
//   503 transitorio      rede/Odoo fora -> tenta de novo depois
// Nunca é cacheada (POST; o service worker não intercepta POST).
export async function POST(req: NextRequest) {
  let corpo: Record<string, unknown>;
  try {
    corpo = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, erro: "Envio inválido.", tipo: "recusada" }, { status: 400 });
  }
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const txt = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
  const cargaId = Number(corpo.cargaId);
  const paradaId = Number(corpo.paradaId);
  if (!Number.isInteger(cargaId) || cargaId <= 0 || !Number.isInteger(paradaId) || paradaId <= 0) {
    return NextResponse.json({ ok: false, erro: "Parada inválida.", tipo: "recusada" }, { status: 422 });
  }
  const entrada: EntradaBaixa = {
    cargaId,
    paradaId,
    resultado: corpo.resultado as EntradaBaixa["resultado"],
    motivo: txt(corpo.motivo),
    obs: txt(corpo.obs),
    geoLat: num(corpo.geoLat),
    geoLng: num(corpo.geoLng),
    fotoUrls: Array.isArray(corpo.fotoUrls) ? corpo.fotoUrls.filter((u): u is string => typeof u === "string") : [],
    itens: Array.isArray(corpo.itens) ? (corpo.itens as { codigo?: unknown; qtd_entregue?: unknown }[]).filter((i) => i && typeof i.codigo === "string").map((i) => ({ codigo: String(i.codigo), qtd_entregue: Number(i.qtd_entregue) || 0 })) : undefined,
    eventoUid: txt(corpo.eventoUid),
    registradoEm: txt(corpo.registradoEm),
  };

  const r = await registrarBaixaParada(await getMotoristaSessao(), entrada);
  if (r.ok) {
    revalidatePath("/assistencia/motorista/odoo");
    return NextResponse.json(r, { headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json(r, { status: STATUS_DA_FALHA[r.tipo], headers: { "Cache-Control": "no-store" } });
}
