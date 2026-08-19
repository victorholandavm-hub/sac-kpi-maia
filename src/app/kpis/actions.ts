"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getProfile, requireRole } from "@/lib/dal";

// Avaliações do Google -- puxadas manualmente uma vez por semana (ver
// src/lib/googleReviews.ts). Quem grava precisa estar logado como
// admin/assistência/SAC, mesmo a tela de KPIs em si não tendo gate de
// login hoje -- escrever dado histórico de avaliação não deveria ficar
// aberto igual a leitura.
export async function setStoreGoogleMapsUrl(storeId: string, url: string): Promise<void> {
  const profile = await getProfile();
  requireRole(profile, "admin", "assistencia", "sac");
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
  const profile = await getProfile();
  requireRole(profile, "admin", "assistencia", "sac");

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
  // 0092_store_google_reviews.sql).
  const { error } = await admin
    .from("store_google_reviews")
    .upsert(
      {
        store_id: storeId,
        captured_at: capturedAt,
        rating: opts.rating,
        review_count: opts.reviewCount,
        captured_by: profile.id,
      },
      { onConflict: "store_id,captured_at" }
    );
  if (error) throw new Error(error.message);

  revalidatePath("/kpis");
}
