"use client";

import { useMemo, useState } from "react";
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { setAssemblerName } from "@/app/assistencia/actions";
import { useToast } from "./ToastProvider";
import { AgendaKanbanCard } from "./AgendaKanbanCard";
import { agendaEffectiveDate, type ServiceRequestSummary } from "@/lib/serviceRequests";

const SEM_MONTADOR = "__sem_montador__";

function Column({
  title,
  id,
  items,
  assemblers,
  onReassign,
  highlight,
}: {
  title: string;
  id: string;
  items: ServiceRequestSummary[];
  assemblers: string[];
  onReassign: (requestId: string, name: string) => void;
  highlight?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className="rounded-xl flex flex-col gap-2 p-3 w-72 shrink-0"
      style={{
        background: isOver ? "color-mix(in srgb, var(--brand-green) 10%, var(--surface-1))" : "var(--surface-1)",
        border: `2px solid ${highlight ? "var(--status-warning)" : "var(--brand-green)"}`,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold" style={{ color: highlight ? "var(--status-warning)" : "var(--text-primary)" }}>
          {title}
        </span>
        <span className="text-xs font-semibold rounded-full px-2 py-0.5" style={{ background: "var(--gridline)", color: "var(--text-secondary)" }}>
          {items.length}
        </span>
      </div>
      <div className="flex flex-col gap-2 min-h-[40px]">
        {items.map((item) => (
          <AgendaKanbanCard key={item.id} item={item} assemblers={assemblers} onReassign={(name) => onReassign(item.id, name)} />
        ))}
      </div>
    </div>
  );
}

// Uma coluna por montador (+ "Sem montador"), arrasta o cartão pra trocar o
// responsável -- reaproveita setAssemblerName (mesma action já usada no
// campo de texto do chamado individual), só uma entrada de UI nova. Estado
// otimista local: move na hora, some se a action der erro. Desfazer é só
// chamar a mesma action de novo com o nome antigo -- não precisa de janela
// de desfazer no servidor, é só um campo de texto sendo sobrescrito, sem
// máquina de estados.
export function AgendaKanbanBoard({ requests, assemblers }: { requests: ServiceRequestSummary[]; assemblers: string[] }) {
  const { showToast } = useToast();
  const [assignment, setAssignment] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(requests.map((r) => [r.id, r.assemblerName]))
  );
  const [undo, setUndo] = useState<{ requestId: string; previousName: string | null; label: string } | null>(null);

  const requestsById = useMemo(() => new Map(requests.map((r) => [r.id, r])), [requests]);

  // Colunas: assemblers já buscado pela página + qualquer nome usado nos
  // chamados que por algum motivo não esteja nessa lista (defensivo).
  const columnNames = useMemo(() => {
    const extra = requests.map((r) => r.assemblerName).filter((n): n is string => !!n);
    return [...new Set([...assemblers, ...extra])].sort((a, b) => a.localeCompare(b));
  }, [assemblers, requests]);

  const itemsByColumn = useMemo(() => {
    const map = new Map<string, ServiceRequestSummary[]>();
    map.set(SEM_MONTADOR, []);
    for (const name of columnNames) map.set(name, []);
    for (const r of requests) {
      const name = assignment[r.id] ?? null;
      const key = name ?? SEM_MONTADOR;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    for (const items of map.values()) {
      items.sort((a, b) => (agendaEffectiveDate(a) ?? "").localeCompare(agendaEffectiveDate(b) ?? ""));
    }
    return map;
  }, [requests, assignment, columnNames]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor)
  );

  function reassign(requestId: string, targetName: string) {
    const request = requestsById.get(requestId);
    if (!request) return;
    const previousName = assignment[requestId] ?? null;
    if (previousName === targetName) return;

    setAssignment((prev) => ({ ...prev, [requestId]: targetName }));
    setAssemblerName(requestId, targetName)
      .then(() => {
        setUndo({ requestId, previousName, label: `#${request.ticketNumber} → ${targetName}` });
        setTimeout(() => setUndo((u) => (u?.requestId === requestId ? null : u)), 5000);
      })
      .catch((err: Error) => {
        setAssignment((prev) => ({ ...prev, [requestId]: previousName }));
        showToast(err.message, "error");
      });
  }

  function handleUndo() {
    if (!undo) return;
    const { requestId, previousName } = undo;
    setUndo(null);
    if (previousName === null) {
      // setAssemblerName não aceita string vazia -- "desfazer pra sem
      // montador" não tem ação equivalente, então só reverte visualmente
      // e avisa que precisa definir de novo manualmente.
      setAssignment((prev) => ({ ...prev, [requestId]: null }));
      showToast("Revertido -- defina o montador de novo pra esse chamado.", "success");
      return;
    }
    reassign(requestId, previousName);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const targetKey = String(over.id);
    if (targetKey === SEM_MONTADOR) return; // sem ação de "remover montador" hoje
    reassign(String(active.id), targetKey);
  }

  return (
    <div className="flex flex-col gap-3">
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex items-start gap-3 overflow-x-auto pb-2">
          <Column
            title="Sem montador"
            id={SEM_MONTADOR}
            items={itemsByColumn.get(SEM_MONTADOR) ?? []}
            assemblers={columnNames}
            onReassign={reassign}
            highlight
          />
          {columnNames.map((name) => (
            <Column key={name} title={name} id={name} items={itemsByColumn.get(name) ?? []} assemblers={columnNames} onReassign={reassign} />
          ))}
        </div>
      </DndContext>

      {undo ? (
        <div
          className="fixed bottom-4 right-4 z-40 flex items-center gap-3 rounded-lg border px-4 py-2.5 shadow-lg"
          style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
        >
          <span className="text-sm" style={{ color: "var(--text-primary)" }}>
            {undo.label}
          </span>
          <button onClick={handleUndo} className="text-sm font-semibold underline" style={{ color: "var(--brand-green)" }}>
            Desfazer
          </button>
        </div>
      ) : null}
    </div>
  );
}
