"use client";

import { useState } from "react";
import { approveDeadline, rejectDeadline } from "@/app/assistencia/actions";
import { useQuickAction } from "./useQuickAction";

function formatDateOnly(value: string | null): string | null {
  if (!value) return null;
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

export function DeadlineActions({
  requestId,
  requestedDeadline,
  deadlineStatus,
  approvedDeadline,
}: {
  requestId: string;
  requestedDeadline: string | null;
  deadlineStatus: "pendente" | "recusado" | "aprovado";
  approvedDeadline: string | null;
}) {
  const { pending, run } = useQuickAction();
  const [proposedDate, setProposedDate] = useState("");
  const isPendente = deadlineStatus === "pendente";
  const isRecusado = deadlineStatus === "recusado";
  const isAprovado = deadlineStatus === "aprovado";

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white shadow-sm p-4">
      <h3 className="text-sm font-semibold text-gray-800">
        {isRecusado ? "Nova data proposta pela assistência" : isAprovado ? "Prazo aprovado — dá pra mudar a qualquer momento" : "Prazo pendente de aprovação"}
      </h3>

      <p className="text-sm text-gray-500">
        Prazo pedido pelo gerente: <strong className="text-gray-800">{formatDateOnly(requestedDeadline) ?? "—"}</strong>
      </p>
      {!isPendente ? (
        <p className="text-sm text-gray-500">
          {isRecusado ? "Data proposta atualmente:" : "Data aprovada atualmente:"}{" "}
          <strong className="text-gray-800">{formatDateOnly(approvedDeadline) ?? "—"}</strong>
        </p>
      ) : null}

      <button
        disabled={pending}
        onClick={() => run(() => approveDeadline(requestId), "Prazo aprovado.")}
        className="text-sm font-semibold rounded-lg px-3.5 py-2 self-start text-white shadow-sm transition-all duration-200 hover:brightness-110 disabled:opacity-60"
        style={{ background: "var(--status-good)" }}
      >
        Aprovar prazo pedido
      </button>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-gray-500">
          {isRecusado ? "Alterar a data proposta:" : isAprovado ? "Ou mudar pra outra data:" : "Ou propor outra data:"}
        </span>
        <input
          type="date"
          value={proposedDate}
          onChange={(e) => setProposedDate(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
        />
        <button
          disabled={pending || !proposedDate}
          onClick={() => run(() => rejectDeadline(requestId, proposedDate), "Data alterada.")}
          className="text-sm font-medium rounded-lg border border-gray-200 px-3.5 py-2 text-gray-600 hover:border-gray-300 hover:text-gray-800 transition-colors duration-150 disabled:opacity-60"
        >
          {isRecusado ? "Atualizar data proposta" : isAprovado ? "Mudar data" : "Recusar e propor"}
        </button>
      </div>
    </div>
  );
}
