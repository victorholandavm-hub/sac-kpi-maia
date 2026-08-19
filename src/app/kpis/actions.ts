"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireDashboardAuth } from "@/lib/dashboardSession";

// Avaliações do Google -- puxadas manualmente uma vez por semana (ver
// src/lib/googleReviews.ts). O painel de KPIs do SAC usa login próprio
// (senha única do time, ver dashboardSession.ts) -- é diferente do login
// da Assistência (Supabase Auth, getProfile em @/lib/dal). Usar o helper
// errado aqui redirecionava pro login da Assistência ao salvar (achado ao
// puxar as avaliações pela primeira vez -- corrigido).
export async function setStoreGoogleMapsUrl(storeId: string, url: string): Promise<void> {
  await requireDashboardAuth();
  const trimmed = url.trim();
  if (!trimmed) throw new Error("Informe o link do Google.");

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("stores").update({ google_maps_url: trimmed }).eq("id", storeId);
  if (error) throw new Error(error.message);

  revalidatePath("/kpis");
}

export async function saveGoogleReviewSnapshot(
  storeId: string,
  opts: { rating: number; reviewCount: number; capturedAt?: string }
): Promise<void> {
  await requireDashboardAuth();

  if (!Number.isFinite(opts.rating) || opts.rating < 0 || opts.rating > 5) {
    throw new Error("Nota inválida (0 a 5).");
  }
  if (!Number.isFinite(opts.reviewCount) || opts.reviewCount < 0) {
    throw new Error("Número de avaliações inválido.");
  }

  const admin = getSupabaseAdmin();
  const capturedAt = opts.capturedAt ?? new Date().toISOString().slice(0, 10);
  // Upsert por (store_id, captured_at) -- rodar a mesma leitura duas vezes
  // no mesmo dia atualiza em vez de duplicar (ver constraint unique em
  // 0092_store_google_reviews.sql). Sem captured_by -- login do painel de
  // KPIs é senha única do time, sem usuário individual pra registrar.
  const { error } = await admin
    .from("store_google_reviews")
    .upsert(
      {
        store_id: storeId,
        captured_at: capturedAt,
        rating: opts.rating,
        review_count: opts.reviewCount,
      },
      { onConflict: "store_id,captured_at" }
    );
  if (error) throw new Error(error.message);

  revalidatePath("/kpis");
}
