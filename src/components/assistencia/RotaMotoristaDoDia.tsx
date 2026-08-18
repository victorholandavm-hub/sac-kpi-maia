"use client";

import { useState } from "react";
import { setRotaDriverAssignment, addRotaExtra, removeRotaExtra, getRotaDriverAssignmentsAction } from "@/app/assistencia/actions";
import { useQuickAction } from "./useQuickAction";
import { ROTAS, ROTA_LABELS, ROTA_COLORS, WEEKDAY_LABELS, type Rota, type RotaDayOverview } from "@/lib/rotas";

// "Motorista do dia" -- painel de 2 semanas (semana atual + seguinte) com a
// rota já pré-preenchida pelo padrão semanal (rota_weekday_config): no dia a
// dia só falta escolher o motorista. Mudar a rota em si (exceção pro padrão)
// fica atrás de "editar rota do dia", pra não competir visualmente com o que
// é escolhido toda hora (pedido do Victor 18/08/2026 -- antes o formulário
// de edição ficava sempre aberto e salvar não deixava claro o que tinha
// ficado gravado).
//
// Só existe UMA rota principal por dia (pedido do Victor 17/08/2026 -- antes
// dava pra editar praia/sul/centro como 3 slots independentes pro mesmo
// dia). Rota extra não tem limite de quantidade.
export function RotaMotoristaDoDia({
  today,
  initialOverview,
  drivers,
}: {
  today: string;
  initialOverview: RotaDayOverview[];
  drivers: string[];
}) {
  const [overview, setOverview] = useState<RotaDayOverview[]>(initialOverview);
  // Fechado por padrão -- só hoje + amanhã (pedido do Victor 18/08/2026: as
  // 2 semanas inteiras tomavam a tela toda). "Mostrar mais rotas" abre a
  // semana atual + seguinte completas, com opção de recuar de novo.
  const [expanded, setExpanded] = useState(false);

  function updateDay(updated: RotaDayOverview) {
    setOverview((prev) => prev.map((d) => (d.date === updated.date ? updated : d)));
  }

  const todayIndex = Math.max(
    overview.findIndex((d) => d.date === today),
    0
  );
  const visibleOverview = expanded ? overview : overview.slice(todayIndex, todayIndex + 2);

  return (
    <div
      className="rounded-lg p-4 flex flex-col gap-1"
      style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}
    >
      <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
        Motorista do dia
      </h3>
      <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
        A rota segue o padrão da semana -- só escolha o motorista. Pra mudar a rota de um dia específico, clique em
        &quot;editar rota do dia&quot;.
      </p>
      <div className="flex flex-col divide-y" style={{ borderColor: "var(--gridline)" }}>
        {visibleOverview.map((day) => (
          <RotaDayRow key={day.date} day={day} today={today} drivers={drivers} onChange={updateDay} />
        ))}
      </div>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="text-xs rounded px-3 py-1.5 border font-medium self-start mt-2"
        style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
      >
        {expanded ? "Mostrar menos" : "Mostrar mais rotas (semana atual + seguinte)"}
      </button>
    </div>
  );
}

function RotaDayRow({
  day,
  today,
  drivers,
  onChange,
}: {
  day: RotaDayOverview;
  today: string;
  drivers: string[];
  onChange: (day: RotaDayOverview) => void;
}) {
  const { pending, run, showToast } = useQuickAction();
  const savedRota = day.assignments.primary?.rota ?? day.expectedRota;
  const savedDriver = day.assignments.primary?.driverName ?? "";

  const [rotaEditOpen, setRotaEditOpen] = useState(false);
  const [extraOpen, setExtraOpen] = useState(false);
  const [rotaValue, setRotaValue] = useState<Rota | "">(savedRota ?? "");
  const [driverValue, setDriverValue] = useState(savedDriver);
  const [extraRota, setExtraRota] = useState<Rota | "">("");
  const [extraDriver, setExtraDriver] = useState("");

  const isToday = day.date === today;
  const dateLabel = new Date(`${day.date}T00:00:00Z`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
  const weekdayLabel = WEEKDAY_LABELS[day.weekday].slice(0, 3);
  const dirty = rotaValue !== (savedRota ?? "") || driverValue.trim() !== savedDriver;

  function cancelRotaEdit() {
    setRotaValue(savedRota ?? "");
    setRotaEditOpen(false);
  }

  function save() {
    if (!rotaValue) {
      showToast("Escolha a rota do dia.", "error");
      return;
    }
    const name = driverValue.trim();
    if (!name) {
      showToast("Escolha um motorista.", "error");
      return;
    }
    const rota = rotaValue;
    run(async () => {
      const result = await setRotaDriverAssignment(day.date, rota, name);
      onChange({ ...day, assignments: { ...day.assignments, primary: { id: day.assignments.primary?.id ?? "", rota, driverName: name } } });
      setRotaEditOpen(false);
      showToast(
        `${weekdayLabel} ${dateLabel}: ${ROTA_LABELS[rota]} com ${name}. ${result.updatedCount} chamado${result.updatedCount === 1 ? "" : "s"} atualizado${result.updatedCount === 1 ? "" : "s"}.`,
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
    const rota = extraRota;
    run(async () => {
      const result = await addRotaExtra(day.date, rota, name);
      const assignments = await getRotaDriverAssignmentsAction(day.date);
      onChange({ ...day, assignments });
      setExtraRota("");
      setExtraDriver("");
      setExtraOpen(false);
      showToast(
        `Rota extra em ${dateLabel}: ${ROTA_LABELS[rota]} com ${name}. ${result.updatedCount} chamado${result.updatedCount === 1 ? "" : "s"} atualizado${result.updatedCount === 1 ? "" : "s"}.`,
        "success"
      );
    });
  }

  function removeExtra(id: string) {
    run(async () => {
      await removeRotaExtra(id);
      onChange({ ...day, assignments: { ...day.assignments, extras: day.assignments.extras.filter((e) => e.id !== id) } });
    }, "Rota extra removida.");
  }

  return (
    <div className="py-2 flex flex-col gap-1" style={isToday ? { background: "var(--surface-2)", margin: "0 -0.5rem", padding: "0.5rem", borderRadius: "0.375rem" } : undefined}>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="w-14 shrink-0">
          <div className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
            {weekdayLabel}
          </div>
          <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {dateLabel}
            {isToday ? " · hoje" : ""}
          </div>
        </div>

        {rotaEditOpen ? (
          <select
            value={rotaValue}
            onChange={(e) => setRotaValue(e.target.value as Rota)}
            className="rounded border px-2 py-1 text-sm shrink-0"
            style={{ borderColor: "var(--border)" }}
            disabled={pending}
          >
            <option value="">Sem rota</option>
            {ROTAS.map((r) => (
              <option key={r} value={r}>
                {ROTA_LABELS[r]}
              </option>
            ))}
          </select>
        ) : (
          <span
            className="text-xs font-medium rounded-full px-2 py-1 shrink-0"
            style={{ background: rotaValue ? ROTA_COLORS[rotaValue] : "var(--surface-2)", color: rotaValue ? "#fff" : "var(--text-muted)" }}
          >
            {rotaValue ? ROTA_LABELS[rotaValue] : "Sem rota"}
          </span>
        )}

        <input
          value={driverValue}
          onChange={(e) => setDriverValue(e.target.value)}
          placeholder="Motorista…"
          list={`motoristas-${day.date}`}
          className="rounded border px-2 py-1 text-sm flex-1 min-w-[120px]"
          style={{ borderColor: "var(--border)" }}
          disabled={pending}
        />
        <datalist id={`motoristas-${day.date}`}>
          {drivers.map((d) => (
            <option key={d} value={d} />
          ))}
        </datalist>

        {dirty ? (
          <button
            type="button"
            disabled={pending}
            onClick={save}
            className="text-xs rounded px-2 py-1 font-medium disabled:opacity-60 shrink-0"
            style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
          >
            Salvar
          </button>
        ) : null}

        <button
          type="button"
          onClick={rotaEditOpen ? cancelRotaEdit : () => setRotaEditOpen(true)}
          className="text-[11px] rounded px-2 py-1 border font-medium shrink-0"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          {rotaEditOpen ? "cancelar" : "editar rota do dia"}
        </button>
      </div>

      {day.assignments.extras.length || extraOpen ? (
        <div className="pl-16 flex flex-col gap-1">
          {day.assignments.extras.map((extra) => (
            <div key={extra.id} className="flex items-center gap-2 flex-wrap">
              <span
                className="text-[11px] rounded-full px-2 py-0.5 shrink-0"
                style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
              >
                {ROTA_LABELS[extra.rota]}
              </span>
              <span className="text-xs flex-1 min-w-0" style={{ color: "var(--text-primary)" }}>
                {extra.driverName}
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() => removeExtra(extra.id)}
                className="text-[11px] underline shrink-0"
                style={{ color: "var(--status-critical)" }}
              >
                remover
              </button>
            </div>
          ))}

          {extraOpen ? (
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={extraRota}
                onChange={(e) => setExtraRota(e.target.value as Rota)}
                className="rounded border px-2 py-1 text-xs"
                style={{ borderColor: "var(--border)" }}
                disabled={pending}
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
                list={`motoristas-extra-${day.date}`}
                className="rounded border px-2 py-1 text-xs flex-1 min-w-[120px]"
                style={{ borderColor: "var(--border)" }}
                disabled={pending}
              />
              <datalist id={`motoristas-extra-${day.date}`}>
                {drivers.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
              <button
                type="button"
                disabled={pending}
                onClick={addExtra}
                className="text-[11px] rounded px-2 py-1 font-medium disabled:opacity-60 shrink-0"
                style={{ border: "1px solid", borderColor: "var(--border)", color: "var(--text-primary)" }}
              >
                salvar
              </button>
              <button
                type="button"
                onClick={() => setExtraOpen(false)}
                className="text-[11px] rounded px-2 py-1 border font-medium shrink-0"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              >
                cancelar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setExtraOpen(true)}
              className="text-[11px] rounded px-2 py-1 border font-medium self-start"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              + rota extra
            </button>
          )}
        </div>
      ) : (
        <div className="pl-16">
          <button
            type="button"
            onClick={() => setExtraOpen(true)}
            className="text-[11px] rounded px-2 py-1 border font-medium"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          >
            + rota extra
          </button>
        </div>
      )}
    </div>
  );
}
