"use client";

import { useMemo, useState } from "react";
import type { AttentionRow } from "@/lib/kpi";
import { categoryLabel, storeLabel } from "@/lib/labels";

const NO_CATEGORY = "__sem_categoria__";

const URGENCY_COLOR: Record<string, string> = {
  alta: "var(--status-critical)",
  media: "var(--status-warning)",
  baixa: "var(--status-good)",
};

function UrgencyDot({ urgency }: { urgency: string }) {
  return (
    <span
      className="inline-block w-2 h-2 rounded-full shrink-0"
      style={{ background: URGENCY_COLOR[urgency] ?? "var(--text-muted)" }}
    />
  );
}

// Substitui a antiga "Fila por atendente" -- em vez de agrupar por quem tá
// atendendo, filtra por categoria (ex.: isolar só "Dúvida", que sozinha não
// diz nada) + busca livre no resumo, pra dar pra ler o que o cliente
// realmente perguntou sem precisar abrir chamado por chamado.
export function OpenTicketsBrowser({ data }: { data: AttentionRow[] }) {
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");

  const categoryOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of data) {
      const key = t.category ?? NO_CATEGORY;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((t) => {
      if (category && (t.category ?? NO_CATEGORY) !== category) return false;
      if (q) {
        const haystack = `${t.summary_ai ?? ""} ${t.store_tag ? storeLabel(t.store_tag) : ""} ${t.product ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [data, category, search]);

  return (
    <div className="rounded-lg border p-4" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
      <h3 className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>
        Chamados em aberto
      </h3>
      <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
        Filtra por categoria (ex.: &quot;Dúvida&quot;) ou busca no resumo pra ver do que se trata cada
        chamado, sem abrir um por um.
      </p>

      <div className="flex items-center gap-2 flex-wrap mb-3">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="text-sm rounded border px-2 py-1.5"
          style={{ borderColor: "var(--border)", color: "var(--text-primary)", background: "var(--surface-1)" }}
        >
          <option value="">Todas as categorias ({data.length})</option>
          {categoryOptions.map(([key, count]) => (
            <option key={key} value={key}>
              {key === NO_CATEGORY ? "Sem categoria" : categoryLabel(key)} ({count})
            </option>
          ))}
        </select>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar no resumo, loja ou produto…"
          className="text-sm rounded border px-2 py-1.5 flex-1 min-w-[200px]"
          style={{ borderColor: "var(--border)" }}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Nenhum chamado encontrado com esse filtro.
        </p>
      ) : (
        <div className="flex flex-col max-h-[32rem] overflow-y-auto">
          {filtered.map((t) => (
            <div key={t.conversation_id} className="py-2 flex flex-col gap-0.5" style={{ borderTop: "1px solid var(--gridline)" }}>
              <div className="flex items-center gap-1.5 text-xs flex-wrap" style={{ color: "var(--text-secondary)" }}>
                <UrgencyDot urgency={t.urgency} />
                <span>{t.store_tag ? storeLabel(t.store_tag) : "Loja não identificada"}</span>
                {t.category ? <span>· {categoryLabel(t.category)}</span> : null}
                <span className="ml-auto" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {Math.round(t.aberto_ha_horas)}h
                </span>
              </div>
              {t.summary_ai ? (
                <p className="text-sm" style={{ color: "var(--text-primary)" }}>
                  {t.summary_ai}
                </p>
              ) : (
                <p className="text-xs italic" style={{ color: "var(--text-muted)" }}>
                  Sem resumo disponível.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
