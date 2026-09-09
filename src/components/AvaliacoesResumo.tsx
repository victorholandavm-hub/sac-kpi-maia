"use client";

import { useState } from "react";
import type { NpsSummary } from "@/lib/kpi";
import type { NpsDetrator, NpsFaseResumo } from "@/lib/npsDetratores";
import { indexColor } from "./NpsCard";
import { NpsDetratoresTable } from "./NpsDetratoresTable";

// Resumo de todas as fases numa tela só -- pedido do Victor 08/09/2026: "a
// primeira aba seja desse resumo de avaliações de todas as fases. Hoje só
// temos do SAC, aí você coloca do sac e as outras fases você deixa com um
// traço". São 5 fases no total: SAC (dado real) + pós-entrega/pós-montagem/
// pós-assistência técnica/2 meses pós-recebimento (as 4 já calculam
// sozinhas -- ver getNpsResumoPorFaseAdicional em npsDetratores.ts pras 3
// primeiras e getCompraNpsResumo em nps2Meses.ts pra última -- e mostram
// "—" com 0 respostas, sem precisar de código novo quando os templates do
// WhatsApp forem aprovados e começarem a responder de verdade). "2 meses
// pós-recebimento" (não "1 mês" -- correção do Victor 09/09/2026) é a
// última a ganhar fonte de dado real, feita adiantando os gatilhos que
// faltavam antes da aprovação dos templates.
function FaseCard({ label, npsIndex, responseCount }: { label: string; npsIndex: number | null; responseCount: number }) {
  return (
    <div className="rounded-lg border p-4 flex flex-col gap-1" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
      <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
        {label}
      </span>
      <span className="text-2xl font-semibold" style={{ color: indexColor(npsIndex) }}>
        {npsIndex ?? "—"}
      </span>
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
        {responseCount > 0 ? `${responseCount} resposta${responseCount > 1 ? "s" : ""}` : "sem respostas ainda"}
      </span>
    </div>
  );
}

export function AvaliacoesResumo({
  npsSummary,
  resumoFasesAdicionais,
  npsDetratores,
}: {
  npsSummary: NpsSummary;
  resumoFasesAdicionais: Record<"montagem" | "assistencia_tecnica" | "entrega" | "compra", NpsFaseResumo>;
  npsDetratores: NpsDetrator[];
}) {
  const [showDetratores, setShowDetratores] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
          NPS por fase
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <FaseCard label="Atendimento (SAC)" npsIndex={npsSummary.npsIndex} responseCount={npsSummary.responseCount} />
          <FaseCard label="Pós-entrega" npsIndex={resumoFasesAdicionais.entrega.npsIndex} responseCount={resumoFasesAdicionais.entrega.responseCount} />
          <FaseCard label="Pós-montagem" npsIndex={resumoFasesAdicionais.montagem.npsIndex} responseCount={resumoFasesAdicionais.montagem.responseCount} />
          <FaseCard
            label="Pós-assistência técnica"
            npsIndex={resumoFasesAdicionais.assistencia_tecnica.npsIndex}
            responseCount={resumoFasesAdicionais.assistencia_tecnica.responseCount}
          />
          <FaseCard label="2 meses pós-recebimento" npsIndex={resumoFasesAdicionais.compra.npsIndex} responseCount={resumoFasesAdicionais.compra.responseCount} />
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowDetratores((v) => !v)}
          className="text-sm font-semibold px-3 py-1.5 rounded-full"
          style={{ background: "color-mix(in srgb, var(--status-critical) 15%, var(--surface-1))", color: "var(--status-critical)" }}
        >
          {showDetratores ? "Ocultar detratores" : `Ver detratores (${npsDetratores.length})`}
        </button>

        {showDetratores ? (
          <div className="flex flex-col gap-3 mt-4">
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Todo mundo que deu nota baixa em qualquer NPS (últimos 6 meses). O motivo do SAC já vem sugerido a
              partir do resumo da conversa no GHL -- confirme ou reescreva depois de ligar.
            </p>
            <NpsDetratoresTable items={npsDetratores} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
