"use client";

import { useState } from "react";
import { createJuniorTruckEntry, updateJuniorTruckEntry, deleteJuniorTruckEntry } from "@/app/assistencia/admin-actions";
import { useQuickAction } from "./useQuickAction";
import type { JuniorTruckEntry, JuniorTruckInput } from "@/lib/juniorTruck";

function formatDateBr(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const inputStyle = { borderColor: "var(--border)" };
const fieldClass = "rounded-lg border px-2.5 py-2 text-sm w-full";

type FormValues = {
  logDate: string;
  loadingTime: string;
  departureTime: string;
  arrivalTime: string;
  unloadingTime: string;
  notes: string;
};

function toInput(values: FormValues): JuniorTruckInput {
  return {
    logDate: values.logDate,
    loadingTime: values.loadingTime || null,
    departureTime: values.departureTime || null,
    arrivalTime: values.arrivalTime || null,
    unloadingTime: values.unloadingTime || null,
    notes: values.notes.trim() || null,
  };
}

function entryToValues(entry: JuniorTruckEntry): FormValues {
  return {
    logDate: entry.logDate,
    loadingTime: entry.loadingTime?.slice(0, 5) ?? "",
    departureTime: entry.departureTime?.slice(0, 5) ?? "",
    arrivalTime: entry.arrivalTime?.slice(0, 5) ?? "",
    unloadingTime: entry.unloadingTime?.slice(0, 5) ?? "",
    notes: entry.notes ?? "",
  };
}

const EMPTY_VALUES: FormValues = { logDate: todayIso(), loadingTime: "", departureTime: "", arrivalTime: "", unloadingTime: "", notes: "" };

function EntryForm({
  values,
  onChange,
  onSave,
  onCancel,
  pending,
  saveLabel,
}: {
  values: FormValues;
  onChange: (values: FormValues) => void;
  onSave: () => void;
  onCancel?: () => void;
  pending: boolean;
  saveLabel: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg p-3" style={{ background: "var(--surface-2)" }}>
      <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
        Data
        <input type="date" value={values.logDate} onChange={(e) => onChange({ ...values, logDate: e.target.value })} className={fieldClass} style={inputStyle} disabled={pending} />
      </label>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          Carregamento
          <input type="time" value={values.loadingTime} onChange={(e) => onChange({ ...values, loadingTime: e.target.value })} className={fieldClass} style={inputStyle} disabled={pending} />
        </label>
        <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          Saída
          <input type="time" value={values.departureTime} onChange={(e) => onChange({ ...values, departureTime: e.target.value })} className={fieldClass} style={inputStyle} disabled={pending} />
        </label>
        <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          Chegada
          <input type="time" value={values.arrivalTime} onChange={(e) => onChange({ ...values, arrivalTime: e.target.value })} className={fieldClass} style={inputStyle} disabled={pending} />
        </label>
        <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          Descarregamento
          <input type="time" value={values.unloadingTime} onChange={(e) => onChange({ ...values, unloadingTime: e.target.value })} className={fieldClass} style={inputStyle} disabled={pending} />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
        Observação
        <input
          value={values.notes}
          onChange={(e) => onChange({ ...values, notes: e.target.value })}
          placeholder="Opcional"
          className={fieldClass}
          style={inputStyle}
          disabled={pending}
        />
      </label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={onSave}
          className="text-xs rounded-lg px-3 py-1.5 font-semibold disabled:opacity-60 shadow-sm"
          style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
        >
          {saveLabel}
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel} className="text-xs rounded-lg px-3 py-1.5 border font-medium" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
            Cancelar
          </button>
        ) : null}
      </div>
    </div>
  );
}

function EntryRow({ entry, onUpdated, onDeleted }: { entry: JuniorTruckEntry; onUpdated: (e: JuniorTruckEntry) => void; onDeleted: (id: string) => void }) {
  const { pending, run } = useQuickAction();
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<FormValues>(entryToValues(entry));

  function save() {
    run(async () => {
      const updated = await updateJuniorTruckEntry(entry.id, toInput(values));
      onUpdated(updated);
      setEditing(false);
    }, "Horários atualizados.");
  }

  function remove() {
    run(async () => {
      await deleteJuniorTruckEntry(entry.id);
      onDeleted(entry.id);
    }, "Registro removido.");
  }

  if (editing) {
    return (
      <EntryForm
        values={values}
        onChange={setValues}
        onSave={save}
        onCancel={() => {
          setValues(entryToValues(entry));
          setEditing(false);
        }}
        pending={pending}
        saveLabel="Salvar"
      />
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap rounded-lg p-3" style={{ border: "1px solid var(--gridline)" }}>
      <div className="flex flex-col gap-1 min-w-0">
        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {formatDateBr(entry.logDate)}
        </span>
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Carregamento {entry.loadingTime?.slice(0, 5) ?? "—"} · Saída {entry.departureTime?.slice(0, 5) ?? "—"} · Chegada {entry.arrivalTime?.slice(0, 5) ?? "—"} · Descarregamento{" "}
          {entry.unloadingTime?.slice(0, 5) ?? "—"}
        </span>
        {entry.notes ? (
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {entry.notes}
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button type="button" onClick={() => setEditing(true)} className="text-xs rounded-lg px-2.5 py-1.5 border font-medium" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
          Editar
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={remove}
          className="text-xs rounded-lg px-2.5 py-1.5 border font-medium disabled:opacity-60"
          style={{ borderColor: "var(--status-critical)", color: "var(--status-critical)" }}
        >
          Excluir
        </button>
      </div>
    </div>
  );
}

// Botão + modal pra controlar os horários do caminhão próprio da
// assistência (Junior) -- pedido do Victor 18/09/2026: "apenas para mim...
// ao lado do botão de gestão de motoristas e rotas". Renderizado condicional
// já em fila/page.tsx (só quando profile.fullName === "Victor", ver
// JUNIOR_TRUCK_LOG_MANAGER_NAME) -- esse componente em si não checa quem
// está vendo, só existe na árvore quando já é pra aparecer. Mesmo padrão
// visual de RotaMotoristaDoDia.tsx (botão outline + modal centralizado),
// que fica bem ao lado dele na aba Entregas.
export function JuniorTruckModalButton({ initialEntries }: { initialEntries: JuniorTruckEntry[] }) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<JuniorTruckEntry[]>(initialEntries);
  const [adding, setAdding] = useState(false);
  const [newValues, setNewValues] = useState<FormValues>(EMPTY_VALUES);
  const { pending, run } = useQuickAction();

  function addEntry() {
    run(async () => {
      const created = await createJuniorTruckEntry(toInput(newValues));
      setEntries((prev) => [created, ...prev].sort((a, b) => (a.logDate < b.logDate ? 1 : a.logDate > b.logDate ? -1 : b.createdAt.localeCompare(a.createdAt))));
      setNewValues({ ...EMPTY_VALUES, logDate: newValues.logDate });
      setAdding(false);
    }, "Horários registrados.");
  }

  function updateEntry(updated: JuniorTruckEntry) {
    setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
  }

  function removeEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs rounded-lg px-3.5 py-2 font-semibold bg-white dark:bg-gray-800 border-2 shadow-sm transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-gray-700 shrink-0"
        style={{ borderColor: "#1B5E3C", color: "light-dark(#1B5E3C, #ffffff)" }}
      >
        🚛 Caminhão do Junior
      </button>

      {open ? (
        <>
          <button aria-label="Fechar controle do caminhão" onClick={() => setOpen(false)} className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.4)" }} />
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-x-4 top-[6vh] z-50 mx-auto max-w-2xl max-h-[88vh] overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-4 shadow-lg flex flex-col gap-3"
          >
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">🚛 Caminhão do Junior</h3>
              <button onClick={() => setOpen(false)} className="text-xs px-2 py-1 rounded text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
                Fechar
              </button>
            </div>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Controle manual dos horários do caminhão próprio da assistência -- carregamento, saída, chegada e descarregamento. Visível só pra você.
            </p>

            {adding ? (
              <EntryForm
                values={newValues}
                onChange={setNewValues}
                onSave={addEntry}
                onCancel={() => {
                  setAdding(false);
                  setNewValues(EMPTY_VALUES);
                }}
                pending={pending}
                saveLabel="Registrar"
              />
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="text-xs rounded-lg px-3 py-2 border font-semibold self-start shadow-sm"
                style={{ background: "var(--brand-green-soft)", borderColor: "var(--brand-green)", color: "var(--text-primary)" }}
              >
                + Novo registro
              </button>
            )}

            {entries.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ color: "var(--text-muted)" }}>
                Nenhum registro ainda.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {entries.map((entry) => (
                  <EntryRow key={entry.id} entry={entry} onUpdated={updateEntry} onDeleted={removeEntry} />
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </>
  );
}
