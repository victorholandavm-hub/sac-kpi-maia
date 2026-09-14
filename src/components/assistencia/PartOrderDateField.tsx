"use client";

import { useState } from "react";
import type { PartOrderFieldHistoryEntry } from "@/lib/partOrders";
import { ROLE_LABELS } from "@/lib/assistenciaLabels";
import { useQuickAction } from "./useQuickAction";

// "Peça chegou em" / "Enviada ao cliente em" editáveis, com histórico --
// pedido do Victor 14/09/2026: "preciso que tanto assistencia quanto
// equipe técnica possam editar a data de chegada da peça e data enviada
// para o cliente, alem disso, preciso que tenha historico em cada uma
// delas". Mesmo esqueleto de ExpectedAtField.tsx (editar inline, sem
// modal) -- generalizado aqui porque agora são DOIS campos (partArrivedAt/
// sentToClientAt) com a mesma mecânica, e ganhou a parte de histórico que
// ExpectedAtField não tinha (SLA nunca teve esse pedido).
function formatDateOnly(value: string | null): string | null {
  if (!value) return null;
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

function formatDateTimeOnly(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

export function PartOrderDateField({
  orderId,
  label,
  value,
  history,
  action,
}: {
  orderId: string;
  label: string;
  value: string | null;
  history: PartOrderFieldHistoryEntry[];
  action: (id: string, newDate: string) => Promise<void>;
}) {
  const { pending, run } = useQuickAction();
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(value ?? "");
  // Histórico escondido por padrão -- pedido implícito de manter a tela
  // limpa (mesmo espírito do resto do módulo peças, "detalhamento" só
  // aparece ao pedir, ver PrejuizoDetalheModal.tsx). Só faz sentido
  // mostrar o link quando existe pelo menos 1 edição pra ver.
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      {editing ? (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded border px-2 py-1 text-sm"
            style={{ borderColor: "var(--border)" }}
            autoFocus
          />
          <button
            disabled={pending}
            onClick={() =>
              run(async () => {
                await action(orderId, date);
                setEditing(false);
              }, "Data atualizada.")
            }
            className="text-xs rounded px-2 py-1 disabled:opacity-60"
            style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
          >
            Salvar
          </button>
          {/* Limpar -- diferente de ExpectedAtField (SLA sempre precisa de
              algum valor), aqui "não aconteceu ainda" é um estado válido
              (desfazer um carimbo colocado por engano numa troca de
              status). Só aparece quando já tem data pra limpar. */}
          {value ? (
            <button
              disabled={pending}
              onClick={() =>
                run(async () => {
                  await action(orderId, "");
                  setEditing(false);
                }, "Data removida.")
              }
              className="text-xs underline disabled:opacity-60"
              style={{ color: "var(--status-critical)" }}
            >
              limpar
            </button>
          ) : null}
          <button
            onClick={() => {
              setDate(value ?? "");
              setEditing(false);
            }}
            className="text-xs underline"
            style={{ color: "var(--text-secondary)" }}
          >
            cancelar
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm" style={{ color: "var(--text-primary)" }}>
            {value ? formatDateOnly(value) : "Não definida"}
          </span>
          <button onClick={() => setEditing(true)} className="text-xs underline" style={{ color: "var(--text-secondary)" }}>
            editar
          </button>
          {history.length > 0 ? (
            <button onClick={() => setShowHistory((v) => !v)} className="text-xs underline" style={{ color: "var(--text-secondary)" }}>
              {showHistory ? "esconder histórico" : `histórico (${history.length})`}
            </button>
          ) : null}
        </div>
      )}
      {showHistory && !editing ? (
        <ul className="flex flex-col gap-1 mt-1 pl-3 border-l-2" style={{ borderColor: "var(--gridline)" }}>
          {history.map((h) => (
            <li key={h.id} className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {formatDateTimeOnly(h.changedAt)} — {h.changedBy} ({ROLE_LABELS[h.changedByRole] ?? h.changedByRole}) mudou de{" "}
              <strong>{formatDateOnly(h.oldValue) ?? "vazio"}</strong> pra <strong>{formatDateOnly(h.newValue) ?? "vazio"}</strong>.
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
