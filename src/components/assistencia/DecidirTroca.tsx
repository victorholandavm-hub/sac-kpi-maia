"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decidirTrocaAction } from "@/app/assistencia/sac/troca/actions";

// Autorizar / recusar a troca (só aparece no login do Victor). Autorizar faz a
// troca na hora pela ponte: confirma antes.
export function DecidirTroca({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirmando, setConfirmando] = useState(false);
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  const decidir = (aprovar: boolean) =>
    start(async () => {
      const r = await decidirTrocaAction(id, aprovar, motivo);
      setMsg(r.ok ? { ok: true, texto: r.dados.mensagem } : { ok: false, texto: r.erro });
      setConfirmando(false);
      setRecusando(false);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-2 pt-1">
      {msg ? (
        <p className="text-sm" style={{ color: msg.ok ? "var(--status-good)" : "var(--status-critical)" }}>
          {msg.texto}
        </p>
      ) : null}
      {confirmando ? (
        <div className="flex flex-wrap items-center gap-2 text-sm" style={{ color: "var(--text-primary)" }}>
          Fazer a troca agora? Gera o crédito/devolução e a venda nova no Odoo.
          <button type="button" disabled={pending} onClick={() => decidir(true)} className="rounded-lg px-3 py-1.5 text-sm font-semibold" style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}>
            {pending ? "Fazendo a troca…" : "Sim, autorizar"}
          </button>
          <button type="button" disabled={pending} onClick={() => setConfirmando(false)} className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
            Não
          </button>
        </div>
      ) : recusando ? (
        <div className="flex flex-wrap items-center gap-2">
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo da recusa (opcional)" className="rounded-lg px-3 py-1.5 text-sm flex-1 min-w-[200px]" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <button type="button" disabled={pending} onClick={() => decidir(false)} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-white" style={{ background: "var(--status-critical)" }}>
            {pending ? "…" : "Recusar"}
          </button>
          <button type="button" disabled={pending} onClick={() => setRecusando(false)} className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
            Voltar
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button type="button" onClick={() => setConfirmando(true)} className="rounded-lg px-4 py-2 text-sm font-semibold" style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}>
            Autorizar troca
          </button>
          <button type="button" onClick={() => setRecusando(true)} className="rounded-lg px-4 py-2 text-sm font-semibold" style={{ background: "var(--surface-2)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
            Recusar
          </button>
        </div>
      )}
    </div>
  );
}
