"use client";

import { useState } from "react";
import {
  setRotaDriverAssignment as assistenciaSetRotaDriverAssignment,
  addRotaExtra as assistenciaAddRotaExtra,
  removeRotaExtra as assistenciaRemoveRotaExtra,
  getRotaDriverAssignmentsAction as assistenciaGetRotaDriverAssignments,
} from "@/app/assistencia/actions";
import { useQuickAction } from "./useQuickAction";
import { ROTAS, ROTA_LABELS, ROTA_COLORS, WEEKDAY_LABELS, type Rota, type RotaDayOverview, type RotaDriverAssignments } from "@/lib/rotas";

type RotaActions = {
  setRotaDriverAssignment: (date: string, rota: string, driverName: string) => Promise<{ updatedCount: number }>;
  addRotaExtra: (date: string, rota: string, driverName: string) => Promise<{ updatedCount: number }>;
  removeRotaExtra: (id: string) => Promise<void>;
  getRotaDriverAssignments: (date: string) => Promise<RotaDriverAssignments>;
};

// Ações padrão = assistência/SAC/admin (getProfile). Everton (expedição, ver
// DISPATCH_SUPERVISOR_DRIVERS) reaproveita esse mesmo componente a partir do
// app do motorista (pedido do Victor 19/08/2026), passando as versões
// autenticadas por sessão de PIN em vez de Supabase Auth (ver
// driver-actions.ts) via a prop `actions` -- resto do componente idêntico,
// só troca de onde vem a permissão.
const DEFAULT_ACTIONS: RotaActions = {
  setRotaDriverAssignment: assistenciaSetRotaDriverAssignment,
  addRotaExtra: assistenciaAddRotaExtra,
  removeRotaExtra: assistenciaRemoveRotaExtra,
  getRotaDriverAssignments: assistenciaGetRotaDriverAssignments,
};

// "Motorista do dia" -- painel de calendário (semana atual + seguinte) com a
// rota já pré-preenchida pelo padrão semanal (rota_weekday_config): no dia a
// dia só falta escolher o motorista. Mudar a rota em si (exceção pro padrão)
// fica atrás do lápis, pra não competir visualmente com o que é escolhido
// toda hora.
//
// Virou grade de calendário (pedido do Victor 18/08/2026 -- antes era uma
// lista vertical de linhas, uma por dia, ocupando muito mais altura pra
// mostrar a mesma informação). `overview` já vem sempre começando numa
// segunda-feira (ver startOfRotaWeek/getRotaWeekOverview), então dá pra
// fatiar direto em duas semanas de 7 dias sem recalcular nada.
//
// Só existe UMA rota principal por dia (pedido do Victor 17/08/2026 -- antes
// dava pra editar praia/sul/centro como 3 slots independentes pro mesmo
// dia). Rota extra não tem limite de quantidade.
const WEEKDAY_SHORT = WEEKDAY_LABELS.map((w) => w.slice(0, 3));

export function RotaMotoristaDoDia({
  today,
  initialOverview,
  drivers,
  actions = DEFAULT_ACTIONS,
}: {
  today: string;
  initialOverview: RotaDayOverview[];
  drivers: string[];
  actions?: RotaActions;
}) {
  const [overview, setOverview] = useState<RotaDayOverview[]>(initialOverview);
  // Fechado por padrão -- só a semana atual (pedido do Victor 18/08/2026: as
  // 2 semanas inteiras tomavam espaço demais). "Mostrar mais rotas" abre a
  // semana seguinte também.
  const [expanded, setExpanded] = useState(false);

  function updateDay(updated: RotaDayOverview) {
    setOverview((prev) => prev.map((d) => (d.date === updated.date ? updated : d)));
  }

  const week1 = overview.slice(0, 7);
  const week2 = overview.slice(7, 14);
  const weeks = expanded ? [week1, week2] : [week1];

  return (
    <div
      className="rounded-lg p-4 flex flex-col gap-2"
      style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}
    >
      <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
        Motorista do dia
      </h3>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        A rota segue o padrão da semana -- só escolha o motorista. Clique no lápis pra mudar a rota de um dia
        específico.
      </p>

      <div className="hidden sm:grid grid-cols-7 gap-1.5">
        {week1.map((day) => (
          <span key={day.date} className="text-[11px] font-semibold text-center" style={{ color: "var(--text-muted)" }}>
            {WEEKDAY_SHORT[day.weekday]}
          </span>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        {weeks.map((week, i) => (
          <div key={i} className="grid grid-cols-2 sm:grid-cols-7 gap-1.5">
            {week.map((day) => (
              <RotaDayCell key={day.date} day={day} today={today} drivers={drivers} onChange={updateDay} actions={actions} />
            ))}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="text-xs rounded px-3 py-1.5 border font-medium self-start mt-1"
        style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text-secondary)" }}
      >
        {expanded ? "Mostrar só essa semana" : "Mostrar semana seguinte também"}
      </button>
    </div>
  );
}

function RotaDayCell({
  day,
  today,
  drivers,
  onChange,
  actions,
}: {
  day: RotaDayOverview;
  today: string;
  drivers: string[];
  onChange: (day: RotaDayOverview) => void;
  actions: RotaActions;
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
  const weekdayLabel = WEEKDAY_SHORT[day.weekday];
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
      const result = await actions.setRotaDriverAssignment(day.date, rota, name);
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
      const result = await actions.addRotaExtra(day.date, rota, name);
      const assignments = await actions.getRotaDriverAssignments(day.date);
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
      await actions.removeRotaExtra(id);
      onChange({ ...day, assignments: { ...day.assignments, extras: day.assignments.extras.filter((e) => e.id !== id) } });
    }, "Rota extra removida.");
  }

  return (
    <div
      className="rounded-md p-1.5 flex flex-col gap-1 min-w-0"
      style={{
        // "Hoje" precisa se destacar de verdade no calendário -- pedido do
        // Victor 19/08/2026 ("cor um pouco mais forte na rota do dia"),
        // var(--surface-2) sozinho era sutil demais pra bater o olho.
        border: isToday ? "2px solid var(--brand-green)" : "1px solid var(--gridline)",
        background: isToday ? "color-mix(in srgb, var(--brand-green) 14%, var(--surface-1))" : "transparent",
      }}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-[11px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>
          <span className="sm:hidden">{weekdayLabel} </span>
          {dateLabel}
          {isToday ? " · hoje" : ""}
        </span>
        <button
          type="button"
          onClick={rotaEditOpen ? cancelRotaEdit : () => setRotaEditOpen(true)}
          aria-label={rotaEditOpen ? "Cancelar edição da rota" : "Editar rota do dia"}
          className="text-xs leading-none shrink-0 rounded px-1 py-0.5"
          style={{ color: "var(--text-secondary)" }}
        >
          {rotaEditOpen ? "✕" : "✏️"}
        </button>
      </div>

      {rotaEditOpen ? (
        <div className="flex flex-col gap-1">
          <select
            value={rotaValue}
            onChange={(e) => setRotaValue(e.target.value as Rota)}
            className="rounded border px-1.5 py-1 text-xs w-full"
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
          <DriverPicker value={driverValue} onChange={setDriverValue} drivers={drivers} disabled={pending} />
          {dirty ? (
            <button
              type="button"
              disabled={pending}
              onClick={save}
              className="text-xs rounded px-2 py-1 font-medium disabled:opacity-60"
              style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
            >
              Salvar
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <span
            className="text-[11px] font-medium rounded-full px-1.5 py-0.5 self-start truncate max-w-full"
            style={{ background: rotaValue ? ROTA_COLORS[rotaValue] : "var(--surface-2)", color: rotaValue ? "#fff" : "var(--text-muted)" }}
          >
            {rotaValue ? ROTA_LABELS[rotaValue] : "Sem rota"}
          </span>
          <span className="text-xs truncate" style={{ color: driverValue ? "var(--text-primary)" : "var(--text-muted)" }}>
            {driverValue || "Sem motorista"}
          </span>
        </>
      )}

      {day.assignments.extras.length > 0 ? (
        <div className="flex flex-col gap-0.5 pt-0.5" style={{ borderTop: "1px solid var(--gridline)" }}>
          {day.assignments.extras.map((extra) => (
            <div key={extra.id} className="flex items-center gap-1 min-w-0">
              <span
                className="text-[10px] rounded-full px-1.5 py-0.5 shrink-0"
                style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
              >
                {ROTA_LABELS[extra.rota]}
              </span>
              <span className="text-[11px] truncate flex-1 min-w-0" style={{ color: "var(--text-primary)" }}>
                {extra.driverName}
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() => removeExtra(extra.id)}
                aria-label="Remover rota extra"
                className="text-[10px] shrink-0"
                style={{ color: "var(--status-critical)" }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {extraOpen ? (
        <div className="flex flex-col gap-1 pt-0.5" style={{ borderTop: "1px solid var(--gridline)" }}>
          <select
            value={extraRota}
            onChange={(e) => setExtraRota(e.target.value as Rota)}
            className="rounded border px-1.5 py-1 text-xs w-full"
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
          <DriverPicker value={extraDriver} onChange={setExtraDriver} drivers={drivers} disabled={pending} />
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={pending}
              onClick={addExtra}
              className="text-[11px] rounded px-2 py-1 font-medium disabled:opacity-60 flex-1"
              style={{ background: "var(--surface-2)", border: "1px solid", borderColor: "var(--border)", color: "var(--text-primary)" }}
            >
              salvar
            </button>
            <button
              type="button"
              onClick={() => setExtraOpen(false)}
              className="text-[11px] rounded px-2 py-1 border font-medium"
              style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setExtraOpen(true)}
          className="text-[10px] rounded px-1.5 py-0.5 border font-medium self-start"
          style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          + extra
        </button>
      )}
    </div>
  );
}

// Era um <input list="..."> + <datalist> -- funciona bem no desktop, mas
// datalist não abre sugestão nenhuma ao tocar em boa parte dos navegadores
// mobile (achado 19/08/2026: Everton reportou "não aparece a lista de
// motoristas" ao tocar no campo, pelo celular). Um <select> nativo sempre
// abre a lista completa ao tocar, em qualquer navegador -- perde a busca por
// texto que o datalist dava no desktop, mas ganha em confiabilidade, que é o
// que importa pra quem usa isso na rua. "+ novo motorista" cai pro campo de
// texto de sempre, pra continuar dando pra cadastrar alguém que ainda não
// está na lista.
function DriverPicker({
  value,
  onChange,
  drivers,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  drivers: string[];
  disabled?: boolean;
}) {
  const [customMode, setCustomMode] = useState(value !== "" && !drivers.includes(value));

  if (customMode) {
    return (
      <div className="flex items-center gap-1">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Nome do motorista…"
          autoFocus
          className="rounded border px-1.5 py-1 text-xs w-full"
          style={{ borderColor: "var(--border)" }}
          disabled={disabled}
        />
        {drivers.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              setCustomMode(false);
              onChange("");
            }}
            className="text-[10px] underline shrink-0"
            style={{ color: "var(--text-secondary)" }}
          >
            lista
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => {
        if (e.target.value === "__novo__") {
          setCustomMode(true);
          onChange("");
        } else {
          onChange(e.target.value);
        }
      }}
      className="rounded border px-1.5 py-1 text-xs w-full"
      style={{ borderColor: "var(--border)" }}
      disabled={disabled}
    >
      <option value="" disabled>
        Motorista…
      </option>
      {drivers.map((d) => (
        <option key={d} value={d}>
          {d}
        </option>
      ))}
      <option value="__novo__">+ novo motorista</option>
    </select>
  );
}
