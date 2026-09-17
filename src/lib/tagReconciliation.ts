import { getSupabaseAdmin } from "./supabaseAdmin";

// Núcleo compartilhado entre /api/ghl-webhook (push -- o GHL nos avisa
// quando muda) e /api/reconcile-tags (pull -- nós perguntamos ao GHL o
// estado atual, de tempos em tempos, pros contatos com atividade recente).
// Mesma lógica de diff contra contact_current_tags dos dois lados -- só
// muda de onde vem `incomingTags` (corpo do webhook vs resposta da API do
// GHL) e o `source` gravado em tag_events, pra distinguir depois qual
// caminho realmente entregou cada tag.
export async function reconcileContactTags(opts: {
  contactId: string;
  ghlContactId: string;
  incomingTags: string[];
  source: "webhook" | "reconcile";
  rawPayload?: unknown;
}): Promise<{ added: string[]; removed: string[] }> {
  const { contactId, ghlContactId, source } = opts;
  const incomingTags = new Set(opts.incomingTags);
  const admin = getSupabaseAdmin();

  const { data: currentRows, error: currentError } = await admin
    .from("contact_current_tags")
    .select("tag")
    .eq("contact_id", contactId);
  if (currentError) throw new Error(currentError.message);
  const existingTags = new Set((currentRows ?? []).map((r) => r.tag as string));

  const added = [...incomingTags].filter((t) => !existingTags.has(t));
  const removed = [...existingTags].filter((t) => !incomingTags.has(t));
  const now = new Date().toISOString();

  if (added.length > 0) {
    const events = added.map((tag) => ({
      contact_id: contactId,
      ghl_contact_id: ghlContactId,
      tag,
      action: "added",
      event_at: now,
      source,
      raw_payload: opts.rawPayload ?? null,
    }));
    const { error } = await admin.from("tag_events").insert(events);
    if (error) throw new Error(error.message);

    const { error: upsertError } = await admin
      .from("contact_current_tags")
      .upsert(
        added.map((tag) => ({ contact_id: contactId, tag, since: now })),
        { onConflict: "contact_id,tag" }
      );
    if (upsertError) throw new Error(upsertError.message);
  }

  if (removed.length > 0) {
    const events = removed.map((tag) => ({
      contact_id: contactId,
      ghl_contact_id: ghlContactId,
      tag,
      action: "removed",
      event_at: now,
      source,
      raw_payload: opts.rawPayload ?? null,
    }));
    const { error } = await admin.from("tag_events").insert(events);
    if (error) throw new Error(error.message);

    const { error: deleteError } = await admin
      .from("contact_current_tags")
      .delete()
      .eq("contact_id", contactId)
      .in("tag", removed);
    if (deleteError) throw new Error(deleteError.message);
  }

  return { added, removed };
}
