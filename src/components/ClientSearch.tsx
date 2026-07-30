"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { searchClientsAction } from "@/app/clientes/actions";
import type { ClientSearchResult } from "@/lib/customerProfile";

export function ClientSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClientSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      searchClientsAction(query)
        .then(setResults)
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="rounded-lg border p-4 flex flex-col gap-2" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar cliente por nome, CPF/CNPJ ou código…"
        className="rounded border px-3 py-2 text-sm"
        style={{ borderColor: "var(--border)" }}
      />
      {loading ? (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Buscando…
        </p>
      ) : null}
      {results.length > 0 ? (
        <div className="flex flex-col divide-y" style={{ borderColor: "var(--gridline)" }}>
          {results.map((r) => (
            <Link
              key={r.cpfCnpj}
              href={`/clientes/${encodeURIComponent(r.cpfCnpj)}`}
              className="py-2 flex items-center justify-between gap-2 hover:opacity-80"
            >
              <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                {r.name}
              </span>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {r.city ?? "—"}
              </span>
            </Link>
          ))}
        </div>
      ) : null}
      {!loading && query.trim().length >= 2 && results.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Nenhum cliente encontrado.
        </p>
      ) : null}
    </div>
  );
}
