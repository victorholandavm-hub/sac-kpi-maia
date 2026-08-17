"use client";

import { useState } from "react";
import { setRotaDriverAssignment, addRotaExtra, removeRotaExtra, getRotaDriverAssignmentsAction } from "@/app/assistencia/actions";
import { useQuickAction } from "./useQuickAction";
import { ROTAS, ROTA_LABELS, type Rota, type RotaDriverAssignments } from "@/lib/rotas";

// "Motorista do dia" -- define de uma vez quem dirige a rota principal
// numa data (em vez de digitar o nome chamado por chamado) e, se precisar,
// carro(s) a mais como "rota extra". Chamado novo agendado pra essa
// rota/data puxa o nome sozinho (ver setSchedule/createSacRequest em
// actions.ts); redefinir aqui também já reatribui quem ainda estava no
// motorista padrão anterior (setRotaDriverAssignment/addRotaExtra cuidam
// disso, sem mexer em quem já foi movido manualmente pra outro carro).
//
// Só existe UMA rota principal por dia (pedido do Victor 17/08/2026 --
// antes dava pra editar praia/sul/centro como 3 slots independentes pro
// mesmo dia, o que não bate com a operação real). Rota extra não tem
// limite de quantidade.
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
  const [assignments, setAssignments] = useState<RotaDriverAssignments>(initialAssignments);
  const [primaryRota, setPrimaryRota] = useState<string>(initialAssignments.primary?.rota ?? "");
  const [primaryDriver, setPrimaryDriver] = useState(initialAssignments.primary?.driverName ?? "");
  const [extraRota, setExtraRota] = useState("");
  const [extraDriver, setExtraDriver] = useState("");
  const [loadingDate, setLoadingDate] = useState(false);

  async function changeDate(newDate: string) {
    setDate(newDate);
    setLoadingDate(true);
    try {
      const data = await getRotaDriverAssignmentsAction(newDate);
      setAssignments(data);
      setPrimaryRota(data.primary?.rota ?? "");
      setPrimaryDriver(data.primary?.driverName ?? "");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Não deu pra carregar essa data.", "error");
    } finally {
      setLoadingDate(false);
    }
  }

  function savePrimary() {
    if (!primaryRota) {
      showToast("Escolha a rota do dia.", "error");
      return;
    }
    const name = primaryDriver.trim();
    if (!name) {
      showToast("Escolha um motorista.", "error");
      return;
    }
    run(async () => {
      const rota = primaryRota as Rota;
      const result = await setRotaDriverAssignment(date, rota, name);
      setAssignments((prev) => ({ ...prev, primary: { id: prev.primary?.id ?? "", rota, driverName: name } }));
      showToast(
        `Rota do dia: ${ROTA_LABELS[rota]} com ${name}. ${result.updatedCount} chamado${result.updatedCount === 1 ? "" : "s"} atualizado${result.updatedCount === 1 ? "" : "s"}.`,
        "success"
      );
    });
  }

  function addExtra() {
    if (!extraRota) {
      showToast("Escolha a rota extra.", "error");
      return;
    }
    const name = extraDriver.trim();
    if (!name) {
      showToast("Escolha um motorista.", "error");
      return;
    }
    run(async () => {
      const rota = extraRota as Rota;
      const result = await addRotaExtra(date, rota, name);
      const data = await getRotaDriverAssignmentsAction(date);
      setAssignments(data);
      setExtraRota("");
      setExtraDriver("");
      showToast(
        `Rota extra adicionada: ${ROTA_LABELS[rota]} com ${name}. ${result.updatedCount} chamado${result.updatedCount === 1 ? "" : "s"} atualizado${result.updatedCount === 1 ? "" : "s"}.`,
        "success"
      );
    });
  }

  function removeExtra(id: string) {
    run(async () => {
      await removeRotaExtra(id);
      setAssignments((prev) => ({ ...prev, extras: prev.extras.filter((e) => e.id !== id) }));
    }, "Rota extra removida.");
  }

  return (
    <div className="rounded-lg border p-4 flex flex-col gap-4" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
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

      <div className="flex flex-col gap-1.5" style={{ opacity: loadingDate ? 0.6 : 1 }}>
        <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          Rota do dia
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={primaryRota}
            onChange={(e) => setPrimaryRota(e.target.value)}
            className="rounded border px-2 py-1.5 text-sm"
            style={{ borderColor: "var(--border)" }}
            disabled={loadingDate}
          >
            <option value="">Escolha a rota…</option>
            {ROTAS.map((r) => (
              <option key={r} value={r}>
                {ROTA_LABELS[r]}
              </option>
            ))}
          </select>
          <input
            value={primaryDriver}
            onChange={(e) => setPrimaryDriver(e.target.value)}
            placeholder="Motorista…"
            list="motoristas-rota-principal"
            className="rounded border px-2 py-1.5 text-sm flex-1 min-w-0"
            style={{ borderColor: "var(--border)" }}
            disabled={loadingDate}
          />
          <datalist id="motoristas-rota-principal">
            {drivers.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
          <button
            type="button"
            disabled={pending || loadingDate}
            onClick={savePrimary}
            className="text-xs rounded px-2 py-1.5 font-medium disabled:opacity-60 shrink-0"
            style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
          >
            Salvar
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5" style={{ opacity: loadingDate ? 0.6 : 1 }}>
        <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          Rota extra{assignments.extras.length ? ` (${assignments.extras.length})` : ""}
        </span>

        {assignments.extras.map((extra) => (
          <div key={extra.id} className="flex items-center gap-2 flex-wrap">
            <span
              className="text-xs rounded-full px-2 py-1 shrink-0"
              style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
            >
              {ROTA_LABELS[extra.rota]}
            </span>
            <span className="text-sm flex-1 min-w-0" style={{ color: "var(--text-primary)" }}>
              {extra.driverName}
            </span>
            <button
              type="button"
              disabled={pending}
              onClick={() => removeExtra(extra.id)}
              className="text-xs underline shrink-0"
              style={{ color: "var(--status-critical)" }}
            >
              remover
            </button>
          </div>
        ))}

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={extraRota}
            onChange={(e) => setExtraRota(e.target.value)}
            className="rounded border px-2 py-1.5 text-sm"
            style={{ borderColor: "var(--border)" }}
            disabled={loadingDate}
          >
            <option value="">Rota…</option>
            {ROTAS.map((r) => (
              <option key={r} value={r}>
                {ROTA_LABELS[r]}
              </option>
            ))}
          </select>
          <input
            value={extraDriver}
            onChange={(e) => setExtraDriver(e.target.value)}
            placeholder="Motorista…"
            list="motoristas-rota-extra"
            className="rounded border px-2 py-1.5 text-sm flex-1 min-w-0"
            style={{ borderColor: "var(--border)" }}
            disabled={loadingDate}
          />
          <datalist id="motoristas-rota-extra">
            {drivers.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
          <button
            type="button"
            disabled={pending || loadingDate}
            onClick={addExtra}
            className="text-xs rounded px-2 py-1.5 font-medium disabled:opacity-60 shrink-0"
            style={{ border: "1px solid", borderColor: "var(--border)", color: "var(--text-primary)" }}
          >
            + adicionar rota extra
          </button>
        </div>
      </div>

      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Preenche sozinho o motorista de todo chamado dessa rota/data, sem mexer em quem já foi movido manualmente pra
        outro carro. Pra mandar UM chamado específico pra outro motorista, edite direto no chamado.
      </p>
    </div>
  );
}
