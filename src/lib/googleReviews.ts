import { getSupabaseAdmin } from "./supabaseAdmin";

export type GoogleReviewPoint = { capturedAt: string; rating: number; reviewCount: number };

export type StoreGoogleReviews = {
  storeId: string;
  storeName: string;
  googleMapsUrl: string | null;
  history: GoogleReviewPoint[];
  latest: GoogleReviewPoint | null;
  // Diferença da nota atual pra leitura anterior -- null quando só tem uma
  // leitura ainda (nada pra comparar).
  ratingDelta: number | null;
};

type StoreRow = { id: string; name: string; google_maps_url: string | null };
type ReviewRow = { store_id: string; captured_at: string; rating: number; review_count: number };

// Avaliações do Google por loja -- puxadas manualmente (o Google não deixa
// automatizar de forma confiável, ver 0092_store_google_reviews.sql), uma
// leitura por semana. Traz TODAS as lojas (mesmo sem link ainda) -- é a
// própria tela (GoogleReviewsSection.tsx) que deixa configurar o link pela
// primeira vez; lojas sem listagem de consumidor no Google (GL, CD) só
// ficam com o campo de link em branco, sem problema.
export async function listStoreGoogleReviews(): Promise<StoreGoogleReviews[]> {
  const admin = getSupabaseAdmin();
  const [{ data: stores, error: storesError }, { data: reviews, error: reviewsError }] = await Promise.all([
    admin.from("stores").select("id, name, google_maps_url").order("name"),
    admin.from("store_google_reviews").select("store_id, captured_at, rating, review_count").order("captured_at", { ascending: true }),
  ]);
  if (storesError) throw new Error(storesError.message);
  if (reviewsError) throw new Error(reviewsError.message);

  const historyByStore = new Map<string, GoogleReviewPoint[]>();
  for (const row of (reviews ?? []) as ReviewRow[]) {
    const list = historyByStore.get(row.store_id) ?? [];
    list.push({ capturedAt: row.captured_at, rating: row.rating, reviewCount: row.review_count });
    historyByStore.set(row.store_id, list);
  }

  return ((stores ?? []) as StoreRow[]).map((s) => {
    const history = historyByStore.get(s.id) ?? [];
    const latest = history.length > 0 ? history[history.length - 1] : null;
    const previous = history.length > 1 ? history[history.length - 2] : null;
    return {
      storeId: s.id,
      storeName: s.name,
      googleMapsUrl: s.google_maps_url,
      history,
      latest,
      ratingDelta: latest && previous ? Math.round((latest.rating - previous.rating) * 10) / 10 : null,
    };
  });
}
