"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setNpsDetratorStatusAction } from "@/app/kpis/actions";
import {
  NPS_DETRATOR_STATUSES,
  NPS_DETRATOR_STATUS_LABELS,
  NPS_DETRATOR_STATUS_COLORS,
  NPS_DETRATOR_ORIGEM_LABELS,
  type NpsDetrator,
  type NpsDetratorStatus,
} from "@/lib/npsDetratores";
import { formatDateTimeBr } from "@/lib/formatDateTime";

// Lista de trabalho dos detratores -- pedido do Victor 08/09/2026. Status +
// motivo editam juntos, num "Salvar" só (não salva a cada tecla) -- só
// aparece quando algo mudou, mesmo padrão de dirty-check de formulários
// simples do projeto.
function DetratorRow({ item }: { item: NpsDetrator }) {
  const router = useRouter();
  const [status, setStatus] = useState<NpsDetratorStatus>(item.status);
  const [motivo, setMotivo] = useState(item.motivo ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = status !== item.status || motivo !== (item.motivo ?? "");

  async function save() {
    setPending(true);
    setError(null);
    try {
      await setNpsDetratorStatusAction(item.origem, item.origemId, status, motivo);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setPending(false);
    }
  }

  return (
    <tr className="border-b align-top" style={{ borderColor: "var(--gridline)" }}>
      <td className="px-3 py-2.5">
        <div className="font-medium" style={{ color: "var(--text-primary)" }}>
          {item.clientName ?? "Sem nome"}
        </div>
        <div className="text-xs" style={{ color: "var(--text-muted)" }}>
          {item.clientPhone ?? "Sem telefone"}
        </div>
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
        {NPS_DETRATOR_ORIGEM_LABELS[item.origem]}
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ background: "color-mix(in srgb, var(--status-critical) 15%, var(--surface-1))", color: "var(--status-critical)" }}
        >
          {item.score}/{item.escala === "1-5" ? 5 : 10}
        </span>
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap text-xs" style={{ color: "var(--text-muted)" }}>
        {formatDateTimeBr(item.respondidoEm)}
      </td>
      <td className="px-3 py-2.5 min-w-[9rem]">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as NpsDetratorStatus)}
          className="text-xs rounded border px-2 py-1 w-full"
          style={{ borderColor: "var(--border)", color: NPS_DETRATOR_STATUS_COLORS[status] }}
        >
          {NPS_DETRATOR_STATUSES.map((s) => (
            <option key={s} value={s}>
              {NPS_DETRATOR_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2.5 min-w-[14rem]">
        <input
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Por que deu nota baixa..."
          className="text-xs rounded border px-2 py-1 w-full"
          style={{ borderColor: "var(--border)" }}
        />
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        {dirty ? (
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="text-xs font-semibold px-2.5 py-1 rounded disabled:opacity-60"
            style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
          >
            {pending ? "Salvando…" : "Salvar"}
          </button>
        ) : null}
        {error ? (
          <p className="text-[11px] mt-1" style={{ color: "var(--status-critical)" }}>
            {error}
          </p>
        ) : null}
      </td>
    </tr>
  );
}

export function NpsDetratoresTable({ items }: { items: NpsDetrator[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Nenhum detrator nos últimos 6 meses. 🎉
      </p>
    );
  }

  return (
    <div className="rounded-lg border overflow-x-auto" style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b" style={{ borderColor: "var(--border)" }}>
            {["Cliente", "Origem", "Nota", "Respondido em", "Status", "Motivo", ""].map((h) => (
              <th key={h} className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <DetratorRow key={`${item.origem}-${item.origemId}`} item={item} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
