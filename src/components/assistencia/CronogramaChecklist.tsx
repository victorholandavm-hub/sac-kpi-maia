"use client";

import { markCronogramaItemDone, unmarkCronogramaItemDone } from "@/app/assistencia/cronograma-actions";
import { useQuickAction } from "./useQuickAction";
import type { CronogramaDiaItem } from "@/lib/cronogramaSac";
import { formatDateTimeShortBr } from "@/lib/formatDateTime";

// Checklist pessoal do atendente -- pedido do Victor 01/10/2026: "quero
// que todos os atendentes fossem colocando como feito, diariamente".
// `editable` é false pra qualquer dia que não seja hoje (a própria página
// já só deixa navegar a tela de admin pra dias passados, mas esse
// componente só é usado na visão pessoal, então nunca deveria receber um
// dia passado de qualquer forma -- defesa a mais, sem custo).
function ChecklistRow({ item, editable }: { item: CronogramaDiaItem; editable: boolean }) {
  const { pending, run } = useQuickAction();
  const done = !!item.completedAt;

  return (
    <li
      className="flex items-center justify-between gap-3 rounded-lg border p-3"
      style={{
        borderColor: item.atrasado ? "var(--status-critical)" : "var(--border)",
        background: done ? "color-mix(in srgb, var(--status-good) 10%, var(--surface-1))" : "var(--surface-1)",
      }}
    >
      <div className="flex flex-col gap-0.5 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono font-semibold" style={{ color: "var(--text-muted)" }}>
            {item.horario}
          </span>
          {item.atrasado ? (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: "var(--status-critical)" }}>
              ATRASADO
            </span>
          ) : null}
        </div>
        <span className="text-sm" style={{ color: "var(--text-primary)" }}>
          {item.descricao}
        </span>
        {done ? (
          <span className="text-xs" style={{ color: "var(--status-good)" }}>
            ✅ Feito em {formatDateTimeShortBr(item.completedAt!)}
          </span>
        ) : null}
      </div>

      {editable ? (
        <button
          disabled={pending}
          onClick={() =>
            run(
              () => (done ? unmarkCronogramaItemDone(item.id) : markCronogramaItemDone(item.id)),
              done ? "Desmarcado." : "Marcado como feito."
            )
          }
          className="text-sm rounded-lg px-3 py-2 font-medium shrink-0 border-2 transition-colors duration-150 disabled:opacity-60"
          style={
            done
              ? { borderColor: "var(--status-good)", color: "var(--status-good)" }
              : { borderColor: "var(--brand-green)", background: "var(--brand-green)", color: "var(--brand-green-ink)" }
          }
        >
          {done ? "Desmarcar" : "Marcar feito"}
        </button>
      ) : null}
    </li>
  );
}

export function CronogramaChecklist({ itens, editable }: { itens: CronogramaDiaItem[]; editable: boolean }) {
  if (itens.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Nenhum item ativo no cronograma ainda.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {itens.map((item) => (
        <ChecklistRow key={item.id} item={item} editable={editable} />
      ))}
    </ul>
  );
}
