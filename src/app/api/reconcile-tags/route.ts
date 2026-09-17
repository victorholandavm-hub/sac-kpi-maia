import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getGhlContactTags } from "@/lib/ghlClient";
import { reconcileContactTags } from "@/lib/tagReconciliation";
import { recordSyncRun, getLastSuccessfulRunAt } from "@/lib/syncRuns";

// Rede de segurança pro /api/ghl-webhook -- pedido do Victor 17/09/2026,
// depois de descobrir que o workflow do GHL ("Painel KPI") ficou 26/08 a
// 17/09/2026 apontando pro domínio antigo da Vercel (pausado na migração
// pra VPS) sem ninguém perceber: 3 semanas de tags reais aplicadas no GHL
// (loja, categoria) nunca chegaram em tag_events, e a cobertura de
// "Chamados por loja" caiu pra 6% sem nenhum erro visível em lugar nenhum.
// Em vez de confiar só no PUSH do webhook, essa rota faz um PULL periódico:
// pergunta direto à API do GHL o estado ATUAL das tags de quem teve
// conversa nas últimas `hours` horas, e reconcilia contra
// contact_current_tags (mesmo diff de sempre, ver tagReconciliation.ts) --
// se o webhook tiver parado de novo por qualquer motivo, essa consulta
// pega a diferença sozinha no próximo ciclo, sem depender de alguém notar.
const MIN_INTERVAL_MINUTES = 60;
const BATCH_LIMIT = 300;
const DEFAULT_WINDOW_HOURS = 48;
// Teto alto o bastante pra cobrir um backfill manual (ex.: a lacuna de
// 26/08 a 17/09/2026 acima) sem virar um "puxa a base toda" por engano.
const MAX_WINDOW_HOURS = 24 * 60;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const lastRunAt = await getLastSuccessfulRunAt("reconcile-tags");
    if (lastRunAt && Date.now() - new Date(lastRunAt).getTime() < MIN_INTERVAL_MINUTES * 60 * 1000) {
      return NextResponse.json({ ok: true, skipped: true, reason: `última rodada com sucesso há menos de ${MIN_INTERVAL_MINUTES}min`, lastRunAt });
    }
    return await runReconcile(req);
  } catch (err) {
    const message = (err as Error).message;
    await recordSyncRun("reconcile-tags", false, {}, [message]);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function runReconcile(req: NextRequest) {
  const admin = getSupabaseAdmin();
  const errors: string[] = [];

  const hoursParam = Number(req.nextUrl.searchParams.get("hours"));
  const hours = Number.isFinite(hoursParam) && hoursParam > 0 ? Math.min(hoursParam, MAX_WINDOW_HOURS) : DEFAULT_WINDOW_HOURS;
  const sinceIso = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  // Conversas com atividade na janela -- candidatos a reconciliar. Contato
  // pode aparecer em mais de uma conversa; dedupe abaixo por contact_id.
  const { data: convoRows, error: convoError } = await admin
    .from("conversations")
    .select("contact_id, ghl_updated_at, last_synced_at")
    .or(`ghl_updated_at.gte.${sinceIso},last_synced_at.gte.${sinceIso}`)
    .not("contact_id", "is", null)
    .limit(2000);
  if (convoError) throw new Error(convoError.message);

  const contactIds = [...new Set((convoRows ?? []).map((r) => r.contact_id as string))].slice(0, BATCH_LIMIT);
  if (contactIds.length === 0) {
    await recordSyncRun("reconcile-tags", true, { candidatesChecked: 0, reconciled: 0, hours });
    return NextResponse.json({ ok: true, candidatesChecked: 0, reconciled: 0, hours });
  }

  const { data: contacts, error: contactsError } = await admin
    .from("contacts")
    .select("id, ghl_contact_id")
    .in("id", contactIds);
  if (contactsError) throw new Error(contactsError.message);

  let reconciled = 0;
  let withDrift = 0;
  for (const contact of contacts ?? []) {
    const ghlContactId = contact.ghl_contact_id as string | null;
    if (!ghlContactId) continue;
    try {
      const tags = await getGhlContactTags(ghlContactId);
      if (tags === null) {
        errors.push(`contact ${contact.id}: falha ao buscar tags no GHL`);
        continue;
      }
      const { added, removed } = await reconcileContactTags({
        contactId: contact.id as string,
        ghlContactId,
        incomingTags: tags,
        source: "reconcile",
      });
      reconciled++;
      if (added.length > 0 || removed.length > 0) withDrift++;
    } catch (err) {
      errors.push(`contact ${contact.id}: ${(err as Error).message}`);
    }
  }

  const ok = errors.length === 0;
  const summary = { candidatesChecked: contacts?.length ?? 0, reconciled, withDrift, hours };
  await recordSyncRun("reconcile-tags", ok, summary, errors);
  return NextResponse.json({ ok, ...summary, errors });
}
