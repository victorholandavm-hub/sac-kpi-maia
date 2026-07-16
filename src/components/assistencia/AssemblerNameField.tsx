"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setAssemblerName } from "@/app/assistencia/actions";

export function AssemblerNameField({
  requestId,
  value,
  assemblers,
}: {
  requestId: string;
  value: string | null;
  assemblers: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(value ?? "");
  const [error, setError] = useState<string | null>(null);

  if (!editing) {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          Nome do montador
        </span>
        <div className="flex items-center gap-2">
          <span className="text-sm" style={{ color: "var(--text-primary)" }}>
            {value ?? "Não definido"}
          </span>
          <button
            onClick={() => setEditing(true)}
            className="text-xs underline"
            style={{ color: "var(--text-secondary)" }}
          >
            {value ? "editar" : "definir"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
        Nome do montador
      </span>
      <div className="flex items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded border px-2 py-1 text-sm"
          style={{ borderColor: "var(--border)" }}
          list={`assemblers-${requestId}`}
          autoFocus
        />
        <datalist id={`assemblers-${requestId}`}>
          {assemblers.map((a) => (
            <option key={a} value={a} />
          ))}
        </datalist>
        <button
          disabled={pending || !name.trim()}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              try {
                await setAssemblerName(requestId, name);
                setEditing(false);
                router.refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Erro inesperado.");
              }
            });
          }}
          className="text-xs rounded px-2 py-1 disabled:opacity-60"
          style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
        >
          Salvar
        </button>
        <button
          onClick={() => {
            setName(value ?? "");
            setEditing(false);
          }}
          className="text-xs underline"
          style={{ color: "var(--text-secondary)" }}
        >
          cancelar
        </button>
      </div>
      {error ? (
        <p className="text-xs" style={{ color: "var(--status-critical)" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
