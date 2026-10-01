"use client";

import { useState } from "react";
import { setCronogramaAtendenteConfigAction } from "@/app/assistencia/cronograma-actions";
import { useQuickAction } from "./useQuickAction";
import type { CronogramaAtendenteComConfig } from "@/lib/cronogramaSac";

// Exceção por atendente -- pedido do Victor 01/10/2026: "joab e luisa nao
// precisam entrar nesse cronograma e alynne só pega a partir da 9h, então
// coloque todo o cronograma 1h pra frente pra ela". `offsetMinutos`
// desloca TODO item do cronograma pra frente, só pra esse atendente --
// 08:00 vira 09:00 com 60min, por exemplo.
function AtendenteRow({ atendente }: { atendente: CronogramaAtendenteComConfig }) {
  const { pending, run } = useQuickAction();
  const [participa, setParticipa] = useState(atendente.participa);
  const [offsetMinutos, setOffsetMinutos] = useState(atendente.offsetMinutos);
  const dirty = participa !== atendente.participa || offsetMinutos !== atendente.offsetMinutos;

  return (
    <li className="flex items-center justify-between gap-3 text-sm flex-wrap">
      <label className="flex items-center gap-2 min-w-[140px]">
        <input type="checkbox" checked={participa} onChange={(e) => setParticipa(e.target.checked)} className="rounded" />
        <span style={{ color: participa ? "var(--text-primary)" : "var(--text-muted)" }}>{atendente.fullName}</span>
      </label>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
          Atraso (min)
          <input
            type="number"
            min={0}
            max={720}
            step={15}
            value={offsetMinutos}
            disabled={!participa}
            onChange={(e) => setOffsetMinutos(Math.max(0, parseInt(e.target.value, 10) || 0))}
            className="w-20 rounded border px-2 py-1 text-sm disabled:opacity-50"
            style={{ borderColor: "var(--border)" }}
          />
        </label>
        <button
          disabled={pending || !dirty}
          onClick={() => run(() => setCronogramaAtendenteConfigAction(atendente.profileId, participa, offsetMinutos), "Salvo.")}
          className="text-xs rounded px-2 py-1 disabled:opacity-40"
          style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
        >
          Salvar
        </button>
      </div>
    </li>
  );
}

export function CronogramaAtendenteAdmin({ atendentes }: { atendentes: CronogramaAtendenteComConfig[] }) {
  if (atendentes.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Nenhum atendente do SAC cadastrado ainda.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {atendentes.map((at) => (
        <AtendenteRow key={at.profileId} atendente={at} />
      ))}
    </ul>
  );
}
