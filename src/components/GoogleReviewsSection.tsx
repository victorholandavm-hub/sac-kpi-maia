"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { setStoreGoogleMapsUrl, saveGoogleReviewSnapshot } from "@/app/kpis/actions";
import type { StoreGoogleReviews } from "@/lib/googleReviews";

function formatDate(value: unknown) {
  if (typeof value !== "string") return "";
  const [, m, d] = value.split("-");
  return `${d}/${m}`;
}

// Avaliações do Google por loja -- puxadas manualmente uma vez por semana
// (pedido do Victor 18/08/2026: o Google não deixa automatizar de forma
// confiável, ver src/lib/googleReviews.ts). Usado na página /avaliacoes
// (aba própria, fora do painel de KPIs -- pedido do Victor 19/08/2026).
// Cada linha tem a nota/qtd atual + um mini-formulário pra registrar a
// leitura de hoje; abaixo, um seletor de loja mostra a evolução em gráfico.
export function GoogleReviewsSection({ stores }: { stores: StoreGoogleReviews[] }) {
  const router = useRouter();
  const [selectedStoreId, setSelectedStoreId] = useState<string>(stores[0]?.storeId ?? "");
  const selectedStore = stores.find((s) => s.storeId === selectedStoreId) ?? null;

  // Ranking por nota atual, maior pra menor -- pedido do Victor 19/08/2026.
  // Quem ainda não tem leitura fica sem posição, no fim da lista (não dá
  // pra ranquear o que não tem nota ainda). Empate na nota desempata por
  // quem tem mais avaliações (nota mais "confiável").
  const rankedStores = useMemo(() => {
    const withRating = stores.filter((s) => s.latest !== null);
    const withoutRating = stores.filter((s) => s.latest === null);
    withRating.sort((a, b) => {
      const byRating = b.latest!.rating - a.latest!.rating;
      if (byRating !== 0) return byRating;
      return b.latest!.reviewCount - a.latest!.reviewCount;
    });
    return [...withRating, ...withoutRating];
  }, [stores]);

  const chartData = useMemo(
    () => (selectedStore?.history ?? []).map((p) => ({ date: p.capturedAt, rating: p.rating })),
    [selectedStore]
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg overflow-x-auto" style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}>
        <table className="w-full text-sm border-collapse min-w-[640px]">
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
              <th className="px-3 py-2 text-right font-semibold">#</th>
              <th className="px-3 py-2 text-left font-semibold">Loja</th>
              <th className="px-3 py-2 text-left font-semibold">Nota atual</th>
              <th className="px-3 py-2 text-left font-semibold">Avaliações</th>
              <th className="px-3 py-2 text-left font-semibold">Última leitura</th>
              <th className="px-3 py-2 text-left font-semibold">Registrar leitura de hoje</th>
            </tr>
          </thead>
          <tbody>
            {rankedStores.map((s, i) => (
              <GoogleReviewRow key={s.storeId} store={s} rank={s.latest ? i + 1 : null} onSaved={() => router.refresh()} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg p-4" style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}>
        <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
          <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            Evolução da nota
          </h3>
          <select
            value={selectedStoreId}
            onChange={(e) => setSelectedStoreId(e.target.value)}
            className="rounded border px-2 py-1 text-sm"
            style={{ borderColor: "var(--border)" }}
          >
            {stores.map((s) => (
              <option key={s.storeId} value={s.storeId}>
                {s.storeName}
              </option>
            ))}
          </select>
        </div>
        {chartData.length < 2 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Ainda só tem {chartData.length === 0 ? "nenhuma leitura" : "1 leitura"} pra essa loja — o gráfico aparece a
            partir da 2ª semana registrada.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ left: 0, right: 16, top: 8, bottom: 4 }}>
              <CartesianGrid vertical={false} stroke="var(--gridline)" />
              <XAxis dataKey="date" tickFormatter={formatDate} stroke="var(--axis)" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
              <YAxis domain={[0, 5]} stroke="var(--axis)" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
              <Tooltip
                labelFormatter={formatDate}
                contentStyle={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", fontSize: 12 }}
              />
              <Line type="monotone" dataKey="rating" stroke="var(--series-3)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function GoogleReviewRow({ store, rank, onSaved }: { store: StoreGoogleReviews; rank: number | null; onSaved: () => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlValue, setUrlValue] = useState(store.googleMapsUrl ?? "");
  const [ratingInput, setRatingInput] = useState(store.latest ? String(store.latest.rating) : "");
  const [countInput, setCountInput] = useState(store.latest ? String(store.latest.reviewCount) : "");

  async function saveUrl() {
    if (urlValue.trim() === (store.googleMapsUrl ?? "")) return;
    setPending(true);
    setError(null);
    try {
      // Sem onSaved()/router.refresh() aqui de propósito -- salvar só o
      // link não muda nada visível na tabela (o input já reflete o valor
      // digitado), e um refresh nesse meio-tempo reflui a página bem na
      // hora que a pessoa ainda está preenchendo nota/nº ao lado, fazendo
      // o próximo clique cair fora do lugar (achado ao puxar as avaliações
      // pela primeira vez -- um refresh no meio da sequência mandou o
      // clique seguinte pra um link sem relação nenhuma).
      await setStoreGoogleMapsUrl(store.storeId, urlValue);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar o link.");
    } finally {
      setPending(false);
    }
  }

  async function saveSnapshot() {
    const rating = parseFloat(ratingInput.replace(",", "."));
    const reviewCount = parseInt(countInput, 10);
    if (!Number.isFinite(rating) || !Number.isFinite(reviewCount)) {
      setError("Preencha nota e nº de avaliações.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await saveGoogleReviewSnapshot(store.storeId, { rating, reviewCount });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar a leitura.");
    } finally {
      setPending(false);
    }
  }

  return (
    <tr className="border-b" style={{ borderColor: "var(--gridline)" }}>
      <td className="px-3 py-2 align-top text-right font-semibold" style={{ color: rank && rank <= 3 ? "var(--brand-orange)" : "var(--text-muted)" }}>
        {rank ?? "—"}
      </td>
      <td className="px-3 py-2 align-top" style={{ color: "var(--text-primary)" }}>
        {store.storeName}
        <input
          value={urlValue}
          onChange={(e) => setUrlValue(e.target.value)}
          onBlur={saveUrl}
          disabled={pending}
          placeholder="Link do Google…"
          className="mt-1 block w-full rounded border px-2 py-1 text-xs"
          style={{ borderColor: "var(--border)" }}
        />
      </td>
      <td className="px-3 py-2 align-top">
        <span className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          {store.latest ? store.latest.rating.toFixed(1) : "—"}
        </span>
        {store.ratingDelta !== null && store.ratingDelta !== 0 ? (
          <span
            className="text-xs font-medium ml-1"
            style={{ color: store.ratingDelta > 0 ? "var(--status-good)" : "var(--status-critical)" }}
          >
            {store.ratingDelta > 0 ? "▲" : "▼"} {Math.abs(store.ratingDelta).toFixed(1)}
          </span>
        ) : null}
      </td>
      <td className="px-3 py-2 align-top" style={{ color: "var(--text-secondary)" }}>
        {store.latest ? store.latest.reviewCount : "—"}
      </td>
      <td className="px-3 py-2 align-top text-xs" style={{ color: "var(--text-muted)" }}>
        {store.latest ? formatDate(store.latest.capturedAt) : "nunca"}
      </td>
      <td className="px-3 py-2 align-top">
        <div className="flex items-center gap-1.5 flex-wrap">
          <input
            value={ratingInput}
            onChange={(e) => setRatingInput(e.target.value)}
            placeholder="Nota"
            className="w-16 rounded border px-2 py-1 text-xs"
            style={{ borderColor: "var(--border)" }}
            disabled={pending}
          />
          <input
            value={countInput}
            onChange={(e) => setCountInput(e.target.value)}
            placeholder="Nº avaliações"
            className="w-24 rounded border px-2 py-1 text-xs"
            style={{ borderColor: "var(--border)" }}
            disabled={pending}
          />
          <button
            type="button"
            onClick={saveSnapshot}
            disabled={pending}
            className="text-xs rounded px-2 py-1 font-medium disabled:opacity-60"
            style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
          >
            Salvar
          </button>
        </div>
        {error ? (
          <p className="text-xs mt-1" style={{ color: "var(--status-critical)" }}>
            {error}
          </p>
        ) : null}
      </td>
    </tr>
  );
}
