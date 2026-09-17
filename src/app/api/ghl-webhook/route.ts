import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { reconcileContactTags } from "@/lib/tagReconciliation";

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
  if (!process.env.GHL_WEBHOOK_SECRET || secret !== process.env.GHL_WEBHOOK_SECRET) {
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

  try {
    const { added, removed } = await reconcileContactTags({
      contactId,
      ghlContactId,
      incomingTags: [...incomingTags],
      source: "webhook",
      rawPayload: body,
    });
    return NextResponse.json({ ok: true, added, removed });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
