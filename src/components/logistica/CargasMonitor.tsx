"use client";

import type { CargaKpi } from "@/lib/kpisLogistica";

// Coluna 1 do "terminal" -- lista compacta e rolável das cargas do período
// selecionado (pedido do Victor 09/10/2026: "monitor de cargas e rotas
// ativas"). Clicar numa carga filtra a tabela de motoristas abaixo pelo
// motorista dessa carga (ver LogisticaTerminal.tsx, que guarda a seleção)
// -- clicar de novo na mesma linha desmarca.
//
// "Status" não é uma coluna que existe no banco -- é derivado aqui dos
// mesmos campos que já vêm na API (pedidos/entregues/parciais/
// naoEntregues/canceladas), mesmo dado que a tabela "Ver as N cargas"
// (expandível, abaixo) já mostrava cru -- só resumido em uma palavra +
// cor pra escaneamento rápido.
function statusCarga(c: CargaKpi): { label: string; color: string } {
  if (c.canceladas > 0 || c.naoEntregues > 0) return { label: "Alerta", color: "var(--status-critical)" };
  if (c.pedidos > 0 && c.entregues === c.pedidos) return { label: "Concluída", color: "var(--status-good)" };
  return { label: "Em rota", color: "var(--series-5)" };
}

function fmt(n: number) {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

function dataBr(dia: string) {
  return dia.split("-").reverse().join("/");
}

export function CargasMonitor({
  cargas,
  selecionada,
  onSelect,
}: {
  cargas: CargaKpi[];
  selecionada: string | null;
  onSelect: (carga: CargaKpi) => void;
}) {
  if (cargas.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Nenhuma carga despachada no período.
      </p>
    );
  }
  return (
    <div className="flex flex-col divide-y max-h-[420px] overflow-y-auto rounded-lg border" style={{ borderColor: "var(--border)" }}>
      {cargas.map((c) => {
        const status = statusCarga(c);
        const unidades = c.volumes.P + c.volumes.M + c.volumes.G + c.volumes.naoClassificado;
        const ativa = selecionada === c.motorista?.codigo;
        return (
          <button
            key={c.carga}
            type="button"
            onClick={() => onSelect(c)}
            className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-left text-xs w-full"
            style={{ background: ativa ? "var(--surface-2)" : "transparent", borderColor: "var(--border)" }}
            title={`${dataBr(c.dia)} · ${c.tipo ?? "Tipo não informado"} · ${c.tipoVeiculo}${c.veiculo ? ` (${c.veiculo})` : ""}`}
          >
            <span className="flex flex-col min-w-0">
              <span className="font-semibold tabular-nums truncate" style={{ color: "var(--text-primary)" }}>
                #{c.carga}
                <span className="ml-1.5 font-normal" style={{ color: "var(--text-muted)" }}>
                  {dataBr(c.dia)}
                </span>
              </span>
              <span className="truncate" style={{ color: "var(--text-secondary)" }}>
                {c.motorista?.nome ?? c.motorista?.codigo ?? "Sem motorista"}
              </span>
            </span>
            <span className="flex flex-col items-end gap-0.5 shrink-0">
              <span
                className="text-[10px] font-semibold px-1.5 rounded-full"
                style={{ color: status.color, background: `color-mix(in srgb, ${status.color} 14%, var(--surface-1))` }}
              >
                {status.label}
              </span>
              <span className="tabular-nums" style={{ color: "var(--text-muted)" }}>
                {fmt(unidades)} un.
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
