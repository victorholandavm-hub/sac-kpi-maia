"use client";

import { useState } from "react";
import { addRotaHoliday, removeRotaHoliday } from "@/app/assistencia/admin-actions";
import { useQuickAction } from "./useQuickAction";
import type { RotaHoliday } from "@/lib/rotas";

function formatDateBr(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

// Feriados (dias sem rota, qualquer dia da semana) -- pedido do Victor
// 05/09/2026: "que eu tenha a opção de colocar isso em qualquer dia, só
// eu, para um feriado". Diferente de RotaWeekdaySelect (padrão fixo por
// dia da semana) -- aqui é uma lista de DATAS específicas, cada uma
// bloqueando agendamento só naquele dia (ver getAvailableRotasForDate,
// rotas.ts), sem mexer no padrão semanal.
export function RotaHolidaysManager({ holidays }: { holidays: RotaHoliday[] }) {
  const { pending, run } = useQuickAction();
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");

  function add() {
    if (!date) return;
    run(async () => {
      await addRotaHoliday(date, note);
      setDate("");
      setNote("");
    }, `${formatDateBr(date)} marcado como feriado.`);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          disabled={pending}
          className="rounded border px-2 py-1 text-sm disabled:opacity-60"
          style={{ borderColor: "var(--border)" }}
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Motivo (opcional, ex.: Natal)"
          disabled={pending}
          className="rounded border px-2 py-1 text-sm flex-1 min-w-[160px] disabled:opacity-60"
          style={{ borderColor: "var(--border)" }}
        />
        <button
          type="button"
          disabled={pending || !date}
          onClick={add}
          className="text-sm rounded px-3 py-1.5 font-medium disabled:opacity-60"
          style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
        >
          Marcar feriado
        </button>
      </div>

      {holidays.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-500">Nenhum feriado marcado.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {holidays.map((h) => (
            <li key={h.date} className="flex items-center justify-between gap-2 text-sm rounded-lg border px-3 py-1.5" style={{ borderColor: "var(--border)" }}>
              <span style={{ color: "var(--text-primary)" }}>
                {formatDateBr(h.date)}
                {h.note ? <span style={{ color: "var(--text-secondary)" }}> — {h.note}</span> : null}
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => removeRotaHoliday(h.date), `${formatDateBr(h.date)} não é mais feriado.`)}
                className="text-xs underline disabled:opacity-60"
                style={{ color: "var(--status-critical)" }}
              >
                remover
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
