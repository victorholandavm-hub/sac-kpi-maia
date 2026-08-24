"use client";

import { useState } from "react";
import {
  setRotaDriverAssignment as assistenciaSetRotaDriverAssignment,
  addRotaExtra as assistenciaAddRotaExtra,
  removeRotaExtra as assistenciaRemoveRotaExtra,
  getRotaDriverAssignmentsAction as assistenciaGetRotaDriverAssignments,
} from "@/app/assistencia/actions";
import { useQuickAction } from "./useQuickAction";
import {
  CG_ROTAS,
  JP_EXTRA_ROTA,
  JP_PRIMARY_ROTAS,
  ROTA_LABELS,
  ROTA_COLORS,
  WEEKDAY_LABELS,
  labelAvailableRota,
  type Rota,
  type RotaDayOverview,
  type RotaDriverAssignments,
} from "@/lib/rotas";

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
  compact,
  defaultDriver,
}: {
  today: string;
  initialOverview: RotaDayOverview[];
  drivers: string[];
  actions?: RotaActions;
  // Everton/Samuel (expedição) não precisam da semana inteira, só hoje +
  // amanhã (pedido do Victor 19/08/2026) -- sem grade de calendário nem
  // "mostrar semana seguinte", só 2 células bem maiores (o pedido era
  // justamente deixar os botões de editar/rota extra maiores, e menos
  // células no mesmo espaço já resolve isso sozinho). `initialOverview` já
  // vem só com os 2 dias nesse modo (ver motorista/page.tsx).
  compact?: boolean;
  // Motorista pré-selecionado ao editar um dia sem motorista salvo ainda --
  // pedido do Victor 21/08/2026 ("deixe Junior como motorista padrão da aba
  // de notificação de assistência"), só passado por quem chama esse
  // componente a partir daquela aba (ver sac/notificacoes/page.tsx). Só
  // preenche quando o dia ainda não tem motorista salvo -- não sobrescreve
  // atribuição já feita.
  defaultDriver?: string;
}) {
  const [overview, setOverview] = useState<RotaDayOverview[]>(initialOverview);
  // Fechado por padrão -- só a semana atual (pedido do Victor 18/08/2026: as
  // 2 semanas inteiras tomavam espaço demais). "Mostrar mais rotas" abre a
  // semana seguinte também. Não existe em modo compact (não tem semana pra
  // expandir).
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

      {compact ? (
        <div className="grid grid-cols-2 gap-2">
          {overview.map((day) => (
            <RotaDayCell
              key={day.date}
              day={day}
              today={today}
              drivers={drivers}
              onChange={updateDay}
              actions={actions}
              defaultDriver={defaultDriver}
              compact
            />
          ))}
        </div>
      ) : (
        <>
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
                  <RotaDayCell
                    key={day.date}
                    day={day}
                    today={today}
                    drivers={drivers}
                    onChange={updateDay}
                    actions={actions}
                    defaultDriver={defaultDriver}
                  />
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
        </>
      )}
    </div>
  );
}

function RotaDayCell({
  day,
  today,
  drivers,
  onChange,
  actions,
  compact,
  defaultDriver,
}: {
  day: RotaDayOverview;
  today: string;
  drivers: string[];
  onChange: (day: RotaDayOverview) => void;
  actions: RotaActions;
  compact?: boolean;
  defaultDriver?: string;
}) {
  const { pending, run, showToast } = useQuickAction();
  const savedRota = day.assignments.primary?.rota ?? day.expectedRota;
  const savedDriver = day.assignments.primary?.driverName ?? "";

  const [rotaEditOpen, setRotaEditOpen] = useState(false);
  const [extraOpen, setExtraOpen] = useState(false);
  const [rotaValue, setRotaValue] = useState<Rota | "">(savedRota ?? "");
  const [driverValue, setDriverValue] = useState(savedDriver || defaultDriver || "");
  const [extraDriver, setExtraDriver] = useState("");
  // Motorista de uma das 2 rotas fixas de Campina Grande -- qual delas
  // está sendo editada agora (null = nenhuma). Pedido do Victor
  // 24/08/2026: "campina nao tem rota extra", as 2 rotas de CG entram
  // como linhas is_extra:true por baixo dos panos (ver Achados no plano),
  // mas na tela nunca aparecem chamadas de "extra" -- seção própria,
  // sempre as mesmas 2, cada uma com seu motorista.
  const [cgPickingRota, setCgPickingRota] = useState<Rota | null>(null);
  const [cgDriverValue, setCgDriverValue] = useState("");

  const isToday = day.date === today;
  // Dia já passado -- pedido do Victor 20/08/2026: "todas as datas que já
  // passaram fiquem bem apagadas, continuem lá, mas quase transparentes
  // para que não sejam confundidas" (com hoje/os próximos dias). Comparação
  // de string funciona direto pra datas ISO (YYYY-MM-DD). Só visual --
  // continua editável normalmente, não trava nada.
  const isPast = day.date < today;
  const dateLabel = new Date(`${day.date}T00:00:00Z`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
  const weekdayLabel = WEEKDAY_SHORT[day.weekday];
  const dirty = rotaValue !== (savedRota ?? "") || driverValue.trim() !== savedDriver;
  // Extras genéricas de João Pessoa (rota extra) -- as de Campina Grande
  // (CG_ROTAS) têm seção própria fixa, não entram aqui.
  const jpExtras = day.assignments.extras.filter((e) => e.rota === JP_EXTRA_ROTA);

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

  // Rota extra genérica de João Pessoa -- pedido do Victor 24/08/2026:
  // "fica por padrão o nome 'rota extra' sem precisar escolher entre
  // sul, centro e praia, só precisando escolher o nome do motorista".
  // Sempre JP_EXTRA_ROTA, sem escolher região -- o ordinal (Rota extra
  // 1, 2...) é calculado na hora de exibir por labelAvailableRota.
  function addExtra() {
    const name = extraDriver.trim();
    if (!name) {
      showToast("Escolha um motorista.", "error");
      return;
    }
    run(async () => {
      const result = await actions.addRotaExtra(day.date, JP_EXTRA_ROTA, name);
      const assignments = await actions.getRotaDriverAssignments(day.date);
      onChange({ ...day, assignments });
      setExtraDriver("");
      setExtraOpen(false);
      showToast(
        `Rota extra em ${dateLabel} com ${name}. ${result.updatedCount} chamado${result.updatedCount === 1 ? "" : "s"} atualizado${result.updatedCount === 1 ? "" : "s"}.`,
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

  // Motorista de uma das 2 rotas fixas de Campina Grande -- mesma
  // action de sempre (addRotaExtra), só que a rota já vem fixa (cgRota),
  // sem escolher.
  function addCgDriver(cgRota: Rota) {
    const name = cgDriverValue.trim();
    if (!name) {
      showToast("Escolha um motorista.", "error");
      return;
    }
    run(async () => {
      const result = await actions.addRotaExtra(day.date, cgRota, name);
      const assignments = await actions.getRotaDriverAssignments(day.date);
      onChange({ ...day, assignments });
      setCgPickingRota(null);
      setCgDriverValue("");
      showToast(
        `${ROTA_LABELS[cgRota]} (Campina Grande) em ${dateLabel} com ${name}. ${result.updatedCount} chamado${result.updatedCount === 1 ? "" : "s"} atualizado${result.updatedCount === 1 ? "" : "s"}.`,
        "success"
      );
    });
  }

  // Modo compact (Everton/Samuel, ver RotaMotoristaDoDia acima): só 2
  // células na tela em vez de 7/14, então dá pra deixar tudo maior -- era
  // justamente o pedido do Victor 19/08/2026 ("deixar os botões de edição e
  // rota extra maiores").
  const cellPadding = compact ? "p-3" : "p-1.5";
  const headerTextClass = compact ? "text-sm font-semibold" : "text-[11px] font-semibold";
  const editButtonClass = compact ? "text-xl leading-none shrink-0 rounded px-2 py-1" : "text-xs leading-none shrink-0 rounded px-1 py-0.5";
  const selectClass = compact ? "rounded border px-3 py-2 text-sm w-full" : "rounded border px-1.5 py-1 text-xs w-full";
  const saveButtonClass = compact
    ? "text-sm rounded px-4 py-2.5 font-medium disabled:opacity-60"
    : "text-xs rounded px-2 py-1 font-medium disabled:opacity-60";
  const rotaBadgeClass = compact
    ? "text-sm font-medium rounded-full px-3 py-1.5 self-start truncate max-w-full"
    : "text-[11px] font-medium rounded-full px-1.5 py-0.5 self-start truncate max-w-full";
  const driverTextClass = compact ? "text-sm truncate" : "text-xs truncate";
  const extraChipClass = compact ? "text-xs rounded-full px-2.5 py-1 shrink-0" : "text-[10px] rounded-full px-1.5 py-0.5 shrink-0";
  const extraDriverTextClass = compact ? "text-sm truncate flex-1 min-w-0" : "text-[11px] truncate flex-1 min-w-0";
  const extraRemoveClass = compact ? "text-base shrink-0 px-1" : "text-[10px] shrink-0";
  const extraActionButtonClass = compact
    ? "text-sm rounded px-4 py-2.5 font-medium disabled:opacity-60 flex-1"
    : "text-[11px] rounded px-2 py-1 font-medium disabled:opacity-60 flex-1";
  const extraCancelButtonClass = compact ? "text-sm rounded px-4 py-2.5 border font-medium" : "text-[11px] rounded px-2 py-1 border font-medium";
  const addExtraButtonClass = compact
    ? "text-sm rounded px-3 py-2 border font-medium self-start"
    : "text-[10px] rounded px-1.5 py-0.5 border font-medium self-start";

  return (
    <div
      className={`rounded-md ${cellPadding} flex flex-col gap-1 min-w-0 transition-opacity`}
      style={{
        // "Hoje" precisa se destacar de verdade no calendário -- pedido do
        // Victor 19/08/2026 ("cor um pouco mais forte na rota do dia"),
        // var(--surface-2) sozinho era sutil demais pra bater o olho.
        border: isToday ? "2px solid var(--brand-green)" : "1px solid var(--gridline)",
        background: isToday ? "color-mix(in srgb, var(--brand-green) 14%, var(--surface-1))" : "transparent",
        opacity: isPast ? 0.3 : 1,
      }}
    >
      <div className="flex items-center justify-between gap-1">
        <span className={`${headerTextClass} truncate`} style={{ color: "var(--text-primary)" }}>
          <span className={compact ? "" : "sm:hidden"}>{weekdayLabel} </span>
          {dateLabel}
          {isToday ? " · hoje" : ""}
        </span>
        <button
          type="button"
          onClick={rotaEditOpen ? cancelRotaEdit : () => setRotaEditOpen(true)}
          aria-label={rotaEditOpen ? "Cancelar edição da rota" : "Editar rota do dia"}
          className={editButtonClass}
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
            className={selectClass}
            style={{ borderColor: "var(--border)" }}
            disabled={pending}
          >
            <option value="">Sem rota</option>
            {/* Só João Pessoa "de verdade" -- a rota principal do dia
                nunca é Campina Grande nem a extra genérica (ver
                JP_PRIMARY_ROTAS em rotas.ts). */}
            {JP_PRIMARY_ROTAS.map((r) => (
              <option key={r} value={r}>
                {ROTA_LABELS[r]}
              </option>
            ))}
          </select>
          <DriverPicker value={driverValue} onChange={setDriverValue} drivers={drivers} disabled={pending} compact={compact} />
          {dirty ? (
            <button type="button" disabled={pending} onClick={save} className={saveButtonClass} style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}>
              Salvar
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <span
            className={rotaBadgeClass}
            style={{ background: rotaValue ? ROTA_COLORS[rotaValue] : "var(--surface-2)", color: rotaValue ? "#fff" : "var(--text-muted)" }}
          >
            {rotaValue ? ROTA_LABELS[rotaValue] : "Sem rota"}
          </span>
          <span className={driverTextClass} style={{ color: driverValue ? "var(--text-primary)" : "var(--text-muted)" }}>
            {driverValue || "Sem motorista"}
          </span>
        </>
      )}

      {/* Rotas extras genéricas de João Pessoa -- pedido do Victor
          24/08/2026: sem escolher região, só o motorista; rótulo com
          ordinal (Rota extra 1, 2...) via labelAvailableRota. Filtra as
          de Campina Grande daqui, elas têm seção própria fixa logo
          abaixo. */}
      {jpExtras.length > 0 ? (
        <div className="flex flex-col gap-0.5 pt-0.5" style={{ borderTop: "1px solid var(--gridline)" }}>
          {jpExtras.map((extra) => (
            <div key={extra.id} className="flex items-center gap-1 min-w-0">
              <span className={extraChipClass} style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
                {labelAvailableRota(jpExtras, extra)}
              </span>
              <span className={extraDriverTextClass} style={{ color: "var(--text-primary)" }}>
                {extra.driverName}
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() => removeExtra(extra.id)}
                aria-label="Remover rota extra"
                className={extraRemoveClass}
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
          <DriverPicker value={extraDriver} onChange={setExtraDriver} drivers={drivers} disabled={pending} compact={compact} />
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={pending}
              onClick={addExtra}
              className={extraActionButtonClass}
              style={{ background: "var(--surface-2)", border: "1px solid", borderColor: "var(--border)", color: "var(--text-primary)" }}
            >
              salvar
            </button>
            <button
              type="button"
              onClick={() => setExtraOpen(false)}
              className={extraCancelButtonClass}
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
          className={addExtraButtonClass}
          style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          + extra
        </button>
      )}

      {/* Campina Grande -- pedido do Victor 24/08/2026: painel único
          com João Pessoa, seção separada. Sempre as 2 rotas fixas
          (CG_ROTAS), sem "+ adicionar" -- "campina nao tem rota extra".
          Por baixo dos panos são linhas is_extra:true igual a rota
          extra de JP (ver Achados no plano), só que nunca aparecem
          rotuladas como "extra" aqui. */}
      <div className="flex flex-col gap-0.5 pt-0.5" style={{ borderTop: "1px solid var(--gridline)" }}>
        <span className={compact ? "text-xs font-semibold" : "text-[10px] font-semibold"} style={{ color: "var(--text-muted)" }}>
          Campina Grande
        </span>
        {CG_ROTAS.map((cgRota) => {
          const assignment = day.assignments.extras.find((e) => e.rota === cgRota);
          if (cgPickingRota === cgRota) {
            return (
              <div key={cgRota} className="flex items-center gap-1 min-w-0">
                <DriverPicker value={cgDriverValue} onChange={setCgDriverValue} drivers={drivers} disabled={pending} compact={compact} />
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => addCgDriver(cgRota)}
                  className={extraActionButtonClass}
                  style={{ background: "var(--surface-2)", border: "1px solid", borderColor: "var(--border)", color: "var(--text-primary)" }}
                >
                  salvar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCgPickingRota(null);
                    setCgDriverValue("");
                  }}
                  className={extraCancelButtonClass}
                  style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text-secondary)" }}
                >
                  cancelar
                </button>
              </div>
            );
          }
          return (
            <div key={cgRota} className="flex items-center gap-1 min-w-0">
              <span className={extraChipClass} style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
                {ROTA_LABELS[cgRota]}
              </span>
              {assignment ? (
                <>
                  <span className={extraDriverTextClass} style={{ color: "var(--text-primary)" }}>
                    {assignment.driverName}
                  </span>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => removeExtra(assignment.id)}
                    aria-label="Remover motorista"
                    className={extraRemoveClass}
                    style={{ color: "var(--status-critical)" }}
                  >
                    ✕
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setCgPickingRota(cgRota);
                    setCgDriverValue("");
                  }}
                  className={addExtraButtonClass}
                  style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text-secondary)" }}
                >
                  + motorista
                </button>
              )}
            </div>
          );
        })}
      </div>
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
  compact,
}: {
  value: string;
  onChange: (value: string) => void;
  drivers: string[];
  disabled?: boolean;
  compact?: boolean;
}) {
  const [customMode, setCustomMode] = useState(value !== "" && !drivers.includes(value));
  const fieldClass = compact ? "rounded border px-3 py-2 text-sm w-full" : "rounded border px-1.5 py-1 text-xs w-full";

  if (customMode) {
    return (
      <div className="flex items-center gap-1">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Nome do motorista…"
          autoFocus
          className={fieldClass}
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
            className={compact ? "text-xs underline shrink-0" : "text-[10px] underline shrink-0"}
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
      className={fieldClass}
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
