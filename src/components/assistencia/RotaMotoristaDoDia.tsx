"use client";

import { useState } from "react";
import { setRotaDriverAssignment, getRotaDriverAssignmentsAction } from "@/app/assistencia/actions";
import { useQuickAction } from "./useQuickAction";
import { ROTAS, ROTA_LABELS, type Rota, type RotaDriverAssignments } from "@/lib/rotas";

// "Motorista do dia" por rota -- define de uma vez quem dirige Praia/Sul/
// Centro numa data, em vez de digitar o nome chamado por chamado. Chamado
// novo agendado pra essa rota/data puxa esse nome sozinho (ver setSchedule
// em actions.ts); redefinir aqui também já reatribui quem ainda estava no
// motorista padrão anterior (setRotaDriverAssignment cuida disso, sem mexer
// em quem já foi movido manualmente pra outro carro).
export function RotaMotoristaDoDia({
  initialDate,
  initialAssignments,
  drivers,
}: {
  initialDate: string;
  initialAssignments: RotaDriverAssignments;
  drivers: string[];
}) {
  const { pending, run, showToast } = useQuickAction();
  const [date, setDate] = useState(initialDate);
  const [inputs, setInputs] = useState<Record<Rota, string>>({
    praia: initialAssignments.praia ?? "",
    sul: initialAssignments.sul ?? "",
    centro: initialAssignments.centro ?? "",
  });
  const [loadingDate, setLoadingDate] = useState(false);

  async function changeDate(newDate: string) {
    setDate(newDate);
    setLoadingDate(true);
    try {
      const data = await getRotaDriverAssignmentsAction(newDate);
      setInputs({ praia: data.praia ?? "", sul: data.sul ?? "", centro: data.centro ?? "" });
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Não deu pra carregar essa data.", "error");
    } finally {
      setLoadingDate(false);
    }
  }

  function save(rota: Rota) {
    const name = inputs[rota].trim();
    if (!name) {
      showToast("Escolha um motorista.", "error");
      return;
    }
    run(async () => {
      const result = await setRotaDriverAssignment(date, rota, name);
      showToast(
        `Motorista de ${ROTA_LABELS[rota]} definido. ${result.updatedCount} chamado${result.updatedCount === 1 ? "" : "s"} atualizado${result.updatedCount === 1 ? "" : "s"}.`,
        "success"
      );
    });
  }

  return (
    <div className="rounded-lg border p-4 flex flex-col gap-3" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
          Motorista do dia
        </h3>
        <input
          type="date"
          value={date}
          onChange={(e) => changeDate(e.target.value)}
          className="rounded border px-2 py-1 text-sm"
          style={{ borderColor: "var(--border)" }}
        />
      </div>
      <div className="grid sm:grid-cols-3 gap-3" style={{ opacity: loadingDate ? 0.6 : 1 }}>
        {ROTAS.map((rota) => (
          <div key={rota} className="flex flex-col gap-1.5">
            <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              {ROTA_LABELS[rota]}
            </span>
            <div className="flex items-center gap-2">
              <input
                value={inputs[rota]}
                onChange={(e) => setInputs((prev) => ({ ...prev, [rota]: e.target.value }))}
                placeholder="Motorista…"
                list={`motoristas-rota-${rota}`}
                className="rounded border px-2 py-1.5 text-sm flex-1 min-w-0"
                style={{ borderColor: "var(--border)" }}
                disabled={loadingDate}
              />
              <datalist id={`motoristas-rota-${rota}`}>
                {drivers.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
              <button
                type="button"
                disabled={pending || loadingDate}
                onClick={() => save(rota)}
                className="text-xs rounded px-2 py-1.5 font-medium disabled:opacity-60 shrink-0"
                style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
              >
                Salvar
              </button>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Preenche sozinho o motorista de todo chamado dessa rota/data, sem mexer em quem já foi movido manualmente pra
        outro carro. Pra mandar UM chamado específico pra outro motorista, edite direto no chamado.
      </p>
    </div>
  );
}
