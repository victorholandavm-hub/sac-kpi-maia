"use client";

import { useEffect, useState } from "react";

// Marca item criado depois da última vez que essa fila foi aberta NESTE
// navegador (localStorage, sem coluna de "visto" no banco -- ver plano).
// Primeira visita (nada salvo ainda) não marca nada como novo, senão a fila
// inteira aparece destacada no primeiro acesso depois do deploy.
export function NewSinceBadge({ createdAt, storageKey }: { createdAt: string; storageKey: string }) {
  const [lastSeen] = useState<string | null>(() =>
    typeof window === "undefined" ? null : window.localStorage.getItem(storageKey)
  );

  useEffect(() => {
    window.localStorage.setItem(storageKey, new Date().toISOString());
  }, [storageKey]);

  if (!lastSeen || new Date(createdAt).getTime() <= new Date(lastSeen).getTime()) return null;

  return (
    <span
      className="text-xs rounded-full px-2 py-0.5 font-medium"
      style={{ background: "var(--series-5)", color: "#fff" }}
    >
      Novo
    </span>
  );
}
