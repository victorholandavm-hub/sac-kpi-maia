"use client";

import { useState } from "react";
import type { NpsSummary } from "@/lib/kpi";
import type { NpsDetrator, NpsFaseResumo } from "@/lib/npsDetratores";
import { NpsDetratoresTable } from "./NpsDetratoresTable";

// Metas sugeridas por fase -- pedido do Victor 24/09/2026, passou uma
// tabela pronta de referência de mercado pra varejo/móveis. `max: null` =
// faixa aberta pra cima ("70+"). SAC continua com meta única (65, já era o
// NPS_INDEX_TARGET de NpsCard.tsx) -- as outras 4 vêm em faixa porque cada
// etapa da jornada tem uma dinâmica diferente (ver justificativa de cada
// uma abaixo).
type MetaRange = { min: number; max: number | null };

const METAS: Record<"sac" | "entrega" | "montagem" | "assistencia_tecnica" | "compra", MetaRange> = {
  // Canal de contenção de atrito -- meta definida, não faixa.
  sac: { min: 65, max: null },
  // Logística (atraso/avaria de transporte) costuma puxar a nota pra
  // baixo -- faixa realista pro varejo tradicional.
  entrega: { min: 45, max: 55 },
  // Serviço dentro da casa do cliente gera forte conexão emocional --
  // tendência de notas bem altas com um montador cordial.
  montagem: { min: 70, max: 80 },
  // Cliente já teve um problema antes (atrito) -- resolver bem reconquista
  // a confiança, mas raramente atinge o topo da escala.
  assistencia_tecnica: { min: 55, max: 65 },
  // NPS relacional (produto + marca depois de usar) -- tende a se
  // estabilizar no topo se o produto for bom.
  compra: { min: 70, max: null },
};

function metaLabel(meta: MetaRange): string {
  return meta.max === null ? `Meta: ${meta.min}+` : `Meta: ${meta.min}–${meta.max}`;
}

// Abaixo da meta = alerta (amarelo); dentro ou acima = bom (verde); negativo
// de verdade continua crítico independente da meta, mesmo critério de
// indexColor (NpsCard.tsx) pro resto do app.
function metaColor(npsIndex: number | null, meta: MetaRange): string {
  if (npsIndex === null) return "var(--text-muted)";
  if (npsIndex < 0) return "var(--status-critical)";
  if (npsIndex < meta.min) return "var(--status-warning)";
  return "var(--status-good)";
}

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
function FaseCard({ label, npsIndex, responseCount, meta }: { label: string; npsIndex: number | null; responseCount: number; meta: MetaRange }) {
  return (
    <div className="rounded-lg border p-4 flex flex-col gap-1" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
      <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
        {label}
      </span>
      <span className="text-2xl font-semibold" style={{ color: metaColor(npsIndex, meta) }}>
        {npsIndex ?? "—"}
      </span>
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
        {responseCount > 0 ? `${responseCount} resposta${responseCount > 1 ? "s" : ""}` : "sem respostas ainda"}
      </span>
      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
        {metaLabel(meta)}
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
          <FaseCard label="Atendimento (SAC)" npsIndex={npsSummary.npsIndex} responseCount={npsSummary.responseCount} meta={METAS.sac} />
          <FaseCard
            label="Pós-entrega"
            npsIndex={resumoFasesAdicionais.entrega.npsIndex}
            responseCount={resumoFasesAdicionais.entrega.responseCount}
            meta={METAS.entrega}
          />
          <FaseCard
            label="Pós-montagem"
            npsIndex={resumoFasesAdicionais.montagem.npsIndex}
            responseCount={resumoFasesAdicionais.montagem.responseCount}
            meta={METAS.montagem}
          />
          <FaseCard
            label="Pós-assistência técnica"
            npsIndex={resumoFasesAdicionais.assistencia_tecnica.npsIndex}
            responseCount={resumoFasesAdicionais.assistencia_tecnica.responseCount}
            meta={METAS.assistencia_tecnica}
          />
          <FaseCard
            label="2 meses pós-recebimento"
            npsIndex={resumoFasesAdicionais.compra.npsIndex}
            responseCount={resumoFasesAdicionais.compra.responseCount}
            meta={METAS.compra}
          />
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
