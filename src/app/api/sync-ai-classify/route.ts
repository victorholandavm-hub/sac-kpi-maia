import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { recordSyncRun, getLastSuccessfulRunAt } from "@/lib/syncRuns";
import { classifyConversation, AI_CLASSIFICATION_MODEL } from "@/lib/aiClassification";

// Mesmo motivo do /api/sync: protege contra disparo duplicado (manual +
// agendado) rodando a mesma leva de classificações duas vezes.
const MIN_INTERVAL_MINUTES = 60;

// Uma rodada de cron processa no máximo isso -- filosofia incremental igual
// ao /api/sync (não estourar tempo/custo numa chamada só); o backfill do
// histórico acontece sozinho ao longo de várias rodadas.
const BATCH_LIMIT = 25;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const lastRunAt = await getLastSuccessfulRunAt("ai-classify");
    if (lastRunAt && Date.now() - new Date(lastRunAt).getTime() < MIN_INTERVAL_MINUTES * 60 * 1000) {
      return NextResponse.json({ ok: true, skipped: true, reason: `última rodada com sucesso há menos de ${MIN_INTERVAL_MINUTES}min`, lastRunAt });
    }
    return await runClassify();
  } catch (err) {
    const message = (err as Error).message;
    await recordSyncRun("ai-classify", false, {}, [message]);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function runClassify() {
  const supabase = getSupabaseAdmin();
  const errors: string[] = [];

  // Fila de pendentes -- nunca analisadas ainda (ver índice parcial na
  // migration 0076). Mais recentes primeiro: prioriza os chamados novos, o
  // histórico antigo vai sendo coberto ao longo das próximas rodadas.
  const { data: pendingConvos, error: pendingError } = await supabase
    .from("conversations")
    .select("id, ghl_conversation_id")
    .is("ai_analyzed_at", null)
    .not("ghl_conversation_id", "is", null)
    .order("ghl_created_at", { ascending: false })
    .limit(200);
  if (pendingError) throw pendingError;

  if (!pendingConvos || pendingConvos.length === 0) {
    await recordSyncRun("ai-classify", true, { candidatesChecked: 0, classified: 0 });
    return NextResponse.json({ ok: true, candidatesChecked: 0, classified: 0 });
  }

  // v_ticket_enriched é a única fonte confiável de categoria/produto hoje
  // (tags do GHL) -- cruza só com os pendentes acima, não a view inteira.
  const ids = pendingConvos.map((c) => c.id);
  const { data: ticketRows, error: ticketError } = await supabase
    .from("v_ticket_enriched")
    .select("conversation_id, category, product")
    .in("conversation_id", ids);
  if (ticketError) throw ticketError;

  const ticketByConvo = new Map((ticketRows ?? []).map((r) => [r.conversation_id as string, r]));

  let classified = 0;
  let skippedAlreadySpecific = 0;
  let processed = 0;

  for (const convo of pendingConvos) {
    if (classified + skippedAlreadySpecific >= BATCH_LIMIT) break;
    processed++;

    const ticket = ticketByConvo.get(convo.id);
    // Sem linha em v_ticket_enriched = chamado sem categoria/loja marcada
    // ainda no GHL -- exatamente o caso que mais precisa da IA.
    const needsCategory = !ticket || !ticket.category || ticket.category === "cat-duvida";
    const needsProduct = !ticket || !ticket.product;

    if (!needsCategory && !needsProduct) {
      // Já tem categoria específica e produto marcados manualmente -- marca
      // como analisado sem gastar chamada de IA, só pra não reconsultar essa
      // mesma conversa toda rodada.
      await supabase.from("conversations").update({ ai_analyzed_at: new Date().toISOString() }).eq("id", convo.id);
      skippedAlreadySpecific++;
      continue;
    }

    try {
      const result = await classifyConversation(convo.ghl_conversation_id);
      const { error: updateError } = await supabase
        .from("conversations")
        .update({
          ai_category: result?.category ?? null,
          ai_product: result?.product ?? null,
          ai_store_tag: result?.storeTag ?? null,
          ai_confidence: result?.confidence ?? null,
          ai_analyzed_at: new Date().toISOString(),
          ai_model: result ? AI_CLASSIFICATION_MODEL : null,
        })
        .eq("id", convo.id);
      if (updateError) throw updateError;
      if (result) classified++;
    } catch (err) {
      // Não marca ai_analyzed_at aqui -- erro pode ser transitório (GHL/IA
      // fora do ar), então essa conversa continua na fila pra próxima rodada
      // tentar de novo, em vez de ficar presa com um erro permanente.
      errors.push(`conversation ${convo.id}: ${(err as Error).message}`);
    }
  }

  const ok = errors.length === 0;
  const summary = { candidatesChecked: processed, classified, skippedAlreadySpecific };
  await recordSyncRun("ai-classify", ok, summary, errors);
  return NextResponse.json({ ok, ...summary, errors });
}
