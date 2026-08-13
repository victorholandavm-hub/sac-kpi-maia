import type { NpsSummary, NpsDetractor } from "@/lib/kpi";
import { NpsDetractorsList } from "./NpsDetractorsList";

// Meta definida pelo usuário -- sem lugar melhor pra guardar isso hoje
// (não é dado do GHL, é decisão de negócio), então fica aqui mesmo.
// Exportado pro banner de resumo (Dashboard.tsx) usar a mesma cor/meta.
export const NPS_INDEX_TARGET = 65;

export function indexColor(value: number | null): string {
  if (value === null) return "var(--text-muted)";
  if (value >= NPS_INDEX_TARGET) return "var(--status-good)";
  if (value >= 0) return "var(--status-warning)";
  return "var(--status-critical)";
}

export function NpsCard({ data, detractors }: { data: NpsSummary; detractors: NpsDetractor[] }) {
  return (
    <div
      className="rounded-lg border p-4 flex flex-col gap-3"
      style={{ background: "var(--surface-1)", borderColor: "var(--border)", borderTop: "3px solid var(--brand-orange)" }}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          Satisfação do atendimento (enquete GHL)
        </h3>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {data.responseCount} avaliações recebidas
          {data.responseRatePct !== null ? ` · ~${data.responseRatePct}% dos ${data.eligibleCount} chamados resolvidos no período` : ""}
        </span>
      </div>

      {data.responseCount === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Sem respostas da enquete ainda no período.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Nota média
            </span>
            <span className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
              {data.avgScore}
              <span className="text-sm font-normal" style={{ color: "var(--text-muted)" }}>
                /5
              </span>
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Índice NPS <span style={{ color: "var(--text-muted)" }}>(meta {NPS_INDEX_TARGET})</span>
            </span>
            <span className="text-2xl font-semibold" style={{ color: indexColor(data.npsIndex) }}>
              {data.npsIndex}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs" style={{ color: "var(--status-good)" }}>
              Promotores (4-5)
            </span>
            <span className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
              {data.promoterPct}%
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Neutros (3)
            </span>
            <span className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
              {data.neutralPct}%
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs" style={{ color: "var(--status-critical)" }}>
              Detratores (1-2)
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
                {data.detractorPct}%
              </span>
              <NpsDetractorsList data={detractors} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
