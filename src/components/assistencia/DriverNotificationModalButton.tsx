"use client";

import { useState } from "react";
import { formatFullAddress, type DriverRequestView } from "@/lib/serviceRequests";
import { REQUEST_TYPE_LABELS, SHIFT_LABELS } from "@/lib/assistenciaLabels";
import { StatusBadge } from "./StatusBadge";

function formatDateOnly(value: string | null): string | null {
  if (!value) return null;
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      <span className="text-sm" style={{ color: "var(--text-primary)" }}>
        {value}
      </span>
    </div>
  );
}

// Resumo rápido, só leitura -- pedido do Victor 18/08/2026: "ver resumo e
// ele vai para o modal", pra não precisar sair da lista da rota só pra
// conferir cliente/endereço/produto. Ações de verdade (concluir, foto)
// continuam exclusivas da tela cheia ("Ver notificação", link já
// existente) -- mesmo desenho de ProductsModalButton.tsx.
export function DriverNotificationModalButton({ item }: { item: DriverRequestView }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className="text-sm rounded-lg px-3 py-2 font-medium shrink-0"
        style={{ background: "var(--surface-2)", border: "2px solid var(--brand-green)", color: "var(--brand-green)" }}
      >
        Ver resumo
      </button>

      {open ? (
        <>
          <button
            aria-label="Fechar notificação"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
            }}
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.4)" }}
          />
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="fixed inset-x-4 top-[10vh] z-50 mx-auto max-w-sm max-h-[75vh] overflow-y-auto rounded-lg border p-4 shadow-lg flex flex-col gap-3"
            style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                  #{item.ticketNumber}
                </span>
                <StatusBadge status={item.status} />
              </div>
              <button
                aria-label="Fechar"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpen(false);
                }}
                className="text-xs px-2 py-1 rounded shrink-0"
                style={{ color: "var(--text-muted)" }}
              >
                Fechar
              </button>
            </div>

            <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
              {REQUEST_TYPE_LABELS[item.type] ?? item.type} · {item.storeName}
            </h3>

            <div className="flex flex-col gap-2">
              <Row label="Cliente" value={item.clientName} />
              <Row label="Telefone" value={item.clientPhone} />
              <Row
                label="Endereço"
                value={[formatFullAddress(item), item.clientNeighborhood].filter(Boolean).join(" — ") || null}
              />
              <Row
                label="Visita agendada"
                value={
                  item.scheduledDate
                    ? `${formatDateOnly(item.scheduledDate)}${item.scheduledTime ? ` às ${item.scheduledTime.slice(0, 5)}` : ""}${item.shift ? ` · ${SHIFT_LABELS[item.shift]}` : ""}`
                    : null
                }
              />
              <Row label="Produtos" value={item.productSummary} />
              <Row label="Motivo" value={item.reason} />
              <Row label="Restrição / observação" value={item.restrictionNote} />
              <Row label="Restrição de horário do cliente" value={item.clientTimeRestriction} />
              <Row label="Autorizado por" value={item.authorizedBy} />
              <Row label="Criado por" value={item.requestedByName} />
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
