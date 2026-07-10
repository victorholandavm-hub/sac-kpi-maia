import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function parseTags(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).map((t) => t.trim()).filter(Boolean);
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return [];
}

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret") ?? req.headers.get("x-webhook-secret");
  if (secret !== process.env.GHL_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const ghlContactId = String(body.contactId ?? body.contact_id ?? "").trim();
  if (!ghlContactId) {
    return NextResponse.json({ error: "contactId ausente" }, { status: 400 });
  }
  const incomingTags = new Set(parseTags(body.tags));

  const supabase = getSupabaseAdmin();

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .upsert(
      {
        ghl_contact_id: ghlContactId,
        name: (body.name as string) ?? undefined,
        phone: (body.phone as string) ?? undefined,
        email: (body.email as string) ?? undefined,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "ghl_contact_id" }
    )
    .select("id")
    .single();
  if (contactError) {
    return NextResponse.json({ error: contactError.message }, { status: 500 });
  }
  const contactId = contact.id as string;

  const { data: currentRows, error: currentError } = await supabase
    .from("contact_current_tags")
    .select("tag")
    .eq("contact_id", contactId);
  if (currentError) {
    return NextResponse.json({ error: currentError.message }, { status: 500 });
  }
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
      source: "webhook",
      raw_payload: body,
    }));
    const { error } = await supabase.from("tag_events").insert(events);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { error: upsertError } = await supabase
      .from("contact_current_tags")
      .upsert(
        added.map((tag) => ({ contact_id: contactId, tag, since: now })),
        { onConflict: "contact_id,tag" }
      );
    if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  if (removed.length > 0) {
    const events = removed.map((tag) => ({
      contact_id: contactId,
      ghl_contact_id: ghlContactId,
      tag,
      action: "removed",
      event_at: now,
      source: "webhook",
      raw_payload: body,
    }));
    const { error } = await supabase.from("tag_events").insert(events);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { error: deleteError } = await supabase
      .from("contact_current_tags")
      .delete()
      .eq("contact_id", contactId)
      .in("tag", removed);
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, added, removed });
}
