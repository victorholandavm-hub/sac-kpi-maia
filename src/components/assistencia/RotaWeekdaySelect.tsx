"use client";

import { setRotaWeekday } from "@/app/assistencia/admin-actions";
import { useQuickAction } from "./useQuickAction";
import { JP_PRIMARY_ROTAS, ROTA_LABELS, WEEKDAY_LABELS, type Rota } from "@/lib/rotas";

export function RotaWeekdaySelect({ weekday, rota }: { weekday: number; rota: Rota | null }) {
  const { pending, run } = useQuickAction();

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm" style={{ color: "var(--text-primary)" }}>
        {WEEKDAY_LABELS[weekday]}
      </span>
      <select
        defaultValue={rota ?? ""}
        disabled={pending}
        onChange={(e) => run(() => setRotaWeekday(weekday, e.target.value), `${WEEKDAY_LABELS[weekday]} atualizado.`)}
        className="rounded border px-2 py-1 text-sm disabled:opacity-60"
        style={{ borderColor: "var(--border)" }}
      >
        <option value="">Sem rota</option>
        {/* Só João Pessoa "de verdade" -- padrão semanal não existe pra
            Campina Grande (confirmado com o Victor 24/08/2026) nem faz
            sentido pra rota extra genérica. */}
        {JP_PRIMARY_ROTAS.map((r) => (
          <option key={r} value={r}>
            {ROTA_LABELS[r]}
          </option>
        ))}
      </select>
    </div>
  );
}
