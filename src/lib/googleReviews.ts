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
  // Primeira leitura já registrada (início do histórico rastreado) -- base
  // do ranking de evolução (ver evolutionRatingDelta abaixo), pedido do
  // Victor 26/08/2026: "preciso de um ranking de melhor evolução". Latest
  // vs primeira, não latest vs anterior (ratingDelta acima) -- com leitura
  // semanal e histórico ainda curto, comparar só a última semana pontual
  // não conta a evolução de verdade desde que a loja começou a ser
  // acompanhada; comparar com a primeira soma tudo que já mudou.
  first: GoogleReviewPoint | null;
  // null quando só tem uma leitura (nada pra comparar -- mesmo critério de
  // ratingDelta) ou quando first === latest (mesma leitura, sem intervalo).
  evolutionRatingDelta: number | null;
  evolutionReviewCountDelta: number | null;
  // Evolução com janela fixa (7/30 dias antes da última leitura) -- pedido
  // do Victor 18/09/2026: "preciso comparar a evolução semanal e mensal"
  // (filtro na tela, ver GoogleReviewsSection.tsx). Diferente de
  // evolutionRatingDelta acima (que sempre compara com a 1ª leitura já
  // registrada, desde o início do histórico) -- aqui compara com a leitura
  // mais recente que já existia há pelo menos 7/30 dias. null quando o
  // histórico ainda não tem 7/30 dias de profundidade.
  evolutionWeek: EvolutionWindow | null;
  evolutionMonth: EvolutionWindow | null;
};

export type EvolutionWindow = {
  baseline: GoogleReviewPoint;
  ratingDelta: number;
  reviewCountDelta: number;
};

type StoreRow = { id: string; name: string; google_maps_url: string | null };
type ReviewRow = { store_id: string; captured_at: string; rating: number; review_count: number };

const DAY_MS = 24 * 60 * 60 * 1000;

// Acha a leitura mais recente que já existia há pelo menos `daysBack` dias
// da última leitura -- não necessariamente EXATAMENTE 7/30 dias atrás
// (leitura é semanal, manual, datas não caem certinho toda semana). history
// já vem ordenado ascendente (ver query abaixo).
function findBaseline(history: GoogleReviewPoint[], latest: GoogleReviewPoint, daysBack: number): GoogleReviewPoint | null {
  const cutoff = new Date(latest.capturedAt).getTime() - daysBack * DAY_MS;
  let candidate: GoogleReviewPoint | null = null;
  for (const point of history) {
    if (point.capturedAt === latest.capturedAt) break;
    if (new Date(point.capturedAt).getTime() <= cutoff) {
      candidate = point;
    } else {
      break;
    }
  }
  return candidate;
}

function evolutionWindow(history: GoogleReviewPoint[], latest: GoogleReviewPoint | null, daysBack: number): EvolutionWindow | null {
  if (!latest) return null;
  const baseline = findBaseline(history, latest, daysBack);
  if (!baseline) return null;
  return {
    baseline,
    ratingDelta: Math.round((latest.rating - baseline.rating) * 10) / 10,
    reviewCountDelta: latest.reviewCount - baseline.reviewCount,
  };
}

// Maia 2 Mangabeira e Maia CD saem da lista (pedido do Victor 19/08/2026) --
// Maia 2 Mangabeira não existe mais como listagem própria (virou Maia 3,
// ver mapeamento "Josefa Taveira" já decidido nesta sessão) e Maia CD é
// centro de distribuição, sem loja física com avaliação de consumidor.
const EXCLUDED_STORE_IDS = new Set(["206", "213"]);

// Avaliações do Google por loja -- puxadas manualmente (o Google não deixa
// automatizar de forma confiável, ver 0092_store_google_reviews.sql), uma
// leitura por semana. Traz todas as lojas com listagem própria (mesmo sem
// link ainda) -- é a própria tela (GoogleReviewsSection.tsx) que deixa
// configurar o link pela primeira vez.
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

  return ((stores ?? []) as StoreRow[])
    .filter((s) => !EXCLUDED_STORE_IDS.has(s.id))
    .map((s) => {
      const history = historyByStore.get(s.id) ?? [];
      const latest = history.length > 0 ? history[history.length - 1] : null;
      const previous = history.length > 1 ? history[history.length - 2] : null;
      const first = history.length > 0 ? history[0] : null;
      return {
        storeId: s.id,
        storeName: s.name,
        googleMapsUrl: s.google_maps_url,
        history,
        latest,
        ratingDelta: latest && previous ? Math.round((latest.rating - previous.rating) * 10) / 10 : null,
        first,
        evolutionRatingDelta: latest && first && first !== latest ? Math.round((latest.rating - first.rating) * 10) / 10 : null,
        evolutionReviewCountDelta: latest && first && first !== latest ? latest.reviewCount - first.reviewCount : null,
        evolutionWeek: evolutionWindow(history, latest, 7),
        evolutionMonth: evolutionWindow(history, latest, 30),
      };
    });
}
