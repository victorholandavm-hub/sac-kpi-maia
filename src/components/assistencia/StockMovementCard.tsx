import { MOVEMENT_TYPE_LABELS } from "@/lib/assistenciaLabels";
import { isPendingWithdrawal, extractPedido, type StockMovement } from "@/lib/stockMovements";

function formatDateOnly(value: string | null): string | null {
  if (!value) return null;
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

// Card de retirada/devolução/reparo de estoque -- pedido do Victor
// 28/08/2026: "remodelar... seguindo o padrão visual de outra tela do
// sistema (com cards e tags)" -- mesma linguagem visual de VisitaCardRow
// (AssistenciaQueueGroup.tsx: status+tipo | cliente em destaque | tag de
// responsável | datas + ação), sem a parte de reordenar/imprimir em
// lote/checkbox, que não faz sentido aqui (stock_movements não tem fila
// nem impressão).
function statusBadge(m: StockMovement): { label: string; bg: string; color: string } {
  if (isPendingWithdrawal(m)) {
    return { label: "Pendente", bg: "var(--brand-orange-soft)", color: "var(--brand-orange)" };
  }
  return {
    label: m.movementType === "retirado" ? "Confirmado" : "Concluído",
    bg: "color-mix(in srgb, var(--status-good) 20%, var(--surface-1))",
    color: "var(--status-good)",
  };
}

export function StockMovementCard({ m }: { m: StockMovement }) {
  const status = statusBadge(m);
  const pedido = extractPedido(m.notes);
  const pending = isPendingWithdrawal(m);
  // Quem "é responsável" muda de sentido conforme o tipo -- retirado tem
  // a etapa da equipe técnica (withdrawnBy), devolvido/reparado só têm
  // quem registrou (responsible). Pendente ainda não tem ninguém.
  const responsavel = pending ? null : m.movementType === "retirado" ? m.withdrawnBy : (m.withdrawnBy ?? m.responsible);
  const dataLabel = pending ? "Aberto em" : m.movementType === "retirado" ? "Confirmado em" : "Concluído em";
  const dataValue = pending ? formatDateOnly(m.loggedDate) : formatDateOnly(m.movementDate);

  return (
    <div className="flex flex-col sm:flex-row sm:items-stretch gap-2 sm:gap-0 p-4">
      {/* Coluna 1: status + tipo de operação */}
      <div className="w-full sm:w-[16%] shrink-0 flex flex-row sm:flex-col gap-2 sm:gap-1 min-w-0 items-center sm:items-start sm:pr-3">
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
          style={{ background: status.bg, color: status.color }}
        >
          {status.label}
        </span>
        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {MOVEMENT_TYPE_LABELS[m.movementType] ?? m.movementType}
        </span>
      </div>

      {/* Coluna 2: produto (nome em destaque, código+pedido, cliente/fábrica) */}
      <div className="w-full sm:w-[38%] shrink-0 flex flex-col gap-0.5 min-w-0 sm:pr-3">
        <span className="text-sm font-bold truncate uppercase" style={{ color: "var(--text-primary)" }}>
          {m.product}
        </span>
        <span className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>
          {m.code ?? "—"}
          {pedido ? ` · Pedido ${pedido}` : ""}
        </span>
        {m.clientName ? (
          <span className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
            👤 {m.clientName}
          </span>
        ) : null}
        {m.factory ? (
          <span className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
            🏭 {m.factory}
            {m.volume ? ` · vol. ${m.volume}` : ""}
          </span>
        ) : null}
      </div>

      {/* Coluna 3: responsável pela retirada/registro */}
      <div className="w-full sm:w-[18%] shrink-0 flex items-center min-w-0 sm:pr-3">
        {responsavel ? (
          <span className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
            🧑‍🔧 {responsavel}
          </span>
        ) : (
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
            style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
          >
            Sem responsável
          </span>
        )}
      </div>

      {/* Coluna 4: data + ação (ver detalhes/observações) */}
      <div className="w-full sm:w-[28%] shrink-0 flex flex-col gap-1 min-w-0 items-start sm:items-end">
        <span className="text-xs whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
          {dataLabel}: {dataValue ?? "—"}
        </span>
        {m.notes ? (
          <details className="group/details">
            <summary
              className="text-xs font-medium px-2 py-1 rounded-full border cursor-pointer list-none [&::-webkit-details-marker]:hidden whitespace-nowrap"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              📋 Ver detalhes
            </summary>
            <p
              className="text-xs whitespace-pre-line mt-1.5 rounded-lg p-2 max-w-xs sm:text-right"
              style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
            >
              {m.notes}
            </p>
          </details>
        ) : null}
      </div>
    </div>
  );
}
