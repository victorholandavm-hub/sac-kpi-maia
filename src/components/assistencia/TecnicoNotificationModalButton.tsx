"use client";

import { useState } from "react";
import { formatFullAddress } from "@/lib/serviceRequests";
import type { TecnicoRequestView } from "@/lib/tecnicos";
import { REQUEST_TYPE_LABELS } from "@/lib/assistenciaLabels";
import { formatDateTimeShortBr } from "@/lib/formatDateTime";

// Fuso explícito (América/Fortaleza), não o fuso do navegador de quem tá
// vendo -- achado do Victor 25/08/2026: sem isso, esse modal batia com o
// card só por coincidência (navegador do Victor já em horário do
// Brasil); alguém acessando de outro fuso veria um horário diferente do
// que está de verdade nas outras telas, todas fixas em América/Fortaleza
// (ver formatDateTime.ts).
function formatDateTime(iso: string | null): string | null {
  if (!iso) return null;
  return formatDateTimeShortBr(iso);
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

// "Ver notificação completa" -- pedido do Victor 20/08/2026, mesmo desenho
// de DriverNotificationModalButton.tsx (resumo em modal, só leitura): a
// equipe técnica só vê o essencial no card (cliente, CPF, quem solicitou),
// endereço/motivo/restrição ficam aqui pra não sobrecarregar a lista.
export function TecnicoNotificationModalButton({ request }: { request: TecnicoRequestView }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs underline shrink-0"
        style={{ color: "var(--brand-green)" }}
      >
        Ver notificação completa
      </button>

      {open ? (
        <>
          <button
            aria-label="Fechar notificação"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.4)" }}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-x-4 top-[10vh] z-50 mx-auto max-w-sm max-h-[75vh] overflow-y-auto rounded-lg border p-4 shadow-lg flex flex-col gap-3"
            style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
          >
            <div className="flex items-start justify-between gap-4">
              <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                #{request.ticketNumber}
              </span>
              <button
                aria-label="Fechar"
                onClick={() => setOpen(false)}
                className="text-xs px-2 py-1 rounded shrink-0"
                style={{ color: "var(--text-muted)" }}
              >
                Fechar
              </button>
            </div>

            <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
              {REQUEST_TYPE_LABELS[request.type] ?? request.type} · {request.storeName}
            </h3>

            <div className="flex flex-col gap-2">
              <Row label="Cliente" value={request.clientName} />
              <Row label="CPF" value={request.clientCpf} />
              <Row label="Telefone" value={request.clientPhone} />
              <Row
                label="Endereço"
                value={[formatFullAddress(request), request.clientNeighborhood].filter(Boolean).join(" — ") || null}
              />
              <Row label="Motivo" value={request.reason} />
              <Row label="Restrição / observação" value={request.restrictionNote} />
              <Row label="Restrição de horário do cliente" value={request.clientTimeRestriction} />
              <Row label="Autorizado por" value={request.authorizedBy} />
              <Row label="Motorista" value={request.driverName} />
              <Row label="Concluído em" value={formatDateTime(request.completedAt)} />
              <Row label="Solicitado por" value={request.requestedByName} />
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
