"use client";

import { useState } from "react";
import { setAssemblerName } from "@/app/assistencia/actions";
import { MANOEL_ONLY_TYPES, MANOEL_ONLY_ASSEMBLER } from "@/lib/assistenciaLabels";
import { useQuickAction } from "./useQuickAction";

export function AssemblerNameField({
  requestId,
  requestType,
  value,
  assemblers,
}: {
  requestId: string;
  requestType: string;
  value: string | null;
  assemblers: string[];
}) {
  const { pending, run } = useQuickAction();
  const isManoelOnly = (MANOEL_ONLY_TYPES as readonly string[]).includes(requestType);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(value ?? (isManoelOnly ? MANOEL_ONLY_ASSEMBLER : ""));

  if (!editing) {
    if (!value) {
      // Sem montador definido, a solicitação não pode avançar pra "Em
      // andamento" (ver RequestActions/updateStatus) — precisa chamar
      // atenção pra isso não passar despercebido no meio da grade de campos.
      return (
        <div
          className="flex flex-col gap-1 rounded-lg p-3 sm:col-span-2"
          style={{ border: "1px solid var(--status-warning)", background: "rgba(217, 119, 6, 0.08)" }}
        >
          <span className="text-xs font-medium" style={{ color: "var(--status-warning)" }}>
            Nome do montador — obrigatório pra iniciar o atendimento
          </span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              Não definido
            </span>
            <button
              onClick={() => setEditing(true)}
              className="text-xs rounded px-2 py-1 font-medium"
              style={{ background: "var(--status-warning)", color: "#fff" }}
            >
              Definir montador
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          Nome do montador
        </span>
        <div className="flex items-center gap-2">
          <span className="text-sm" style={{ color: "var(--text-primary)" }}>
            {value}
          </span>
          <button
            onClick={() => setEditing(true)}
            className="text-xs underline"
            style={{ color: "var(--text-secondary)" }}
          >
            editar
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
        {isManoelOnly ? (
          <span className="rounded border px-2 py-1 text-sm" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
            {MANOEL_ONLY_ASSEMBLER}
          </span>
        ) : (
          <>
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
          </>
        )}
        <button
          disabled={pending || !name.trim()}
          onClick={() =>
            run(async () => {
              await setAssemblerName(requestId, name);
              setEditing(false);
            }, "Montador atualizado.")
          }
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
    </div>
  );
}
