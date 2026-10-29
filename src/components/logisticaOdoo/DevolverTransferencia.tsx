"use client";
import { useState } from "react";
import { devolverTransferenciaAction } from "@/app/assistencia/logistica/logistica-actions";
import { useAcaoOdoo } from "./useAcaoOdoo";
import { botaoClass, botaoPerigoStyle, botaoStyle } from "./ui";

// 29/10 (Eduardo/Pedro): Campina mandou a 5152 6692 com código da fábrica e só chegou 1 sofá. O CD devolve/recusa aqui:
// marca o que volta (tudo ou parte) e sai uma 5152 do CD para a loja; o estoque dos dois lados fica certo.
export function DevolverTransferencia({ companyId, chave, numero, itens }: { companyId: number; chave: string; numero: string; itens: { codigo: string; nome: string; qtd: number }[] }) {
  const { pending, run } = useAcaoOdoo();
  const [aberto, setAberto] = useState(false);
  const [qtd, setQtd] = useState<Record<string, number>>(() => Object.fromEntries(itens.map((i) => [i.codigo, i.qtd])));
  const [obs, setObs] = useState("");
  if (!chave) return null;
  if (!aberto) return <button type="button" className={botaoClass} style={botaoPerigoStyle} onClick={() => setAberto(true)}>↩️ Devolver / recusar</button>;
  return (
    <div className="rounded-lg p-2 mt-1 space-y-1" style={{ border: "1px solid var(--border)", background: "var(--surface-1)" }}>
      {itens.map((i) => (
        <label key={i.codigo} className="flex items-center gap-2 text-xs">
          <input type="number" min={0} max={i.qtd} step={1} value={qtd[i.codigo] ?? 0} onChange={(e) => setQtd((q) => ({ ...q, [i.codigo]: Number(e.target.value) }))} className="w-16 rounded px-1 py-0.5" style={{ border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-primary)" }} />
          <span>de {i.qtd} · {i.codigo} {i.nome}</span>
        </label>
      ))}
      <input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Motivo (ex.: código errado / não chegou)" className="w-full rounded px-2 py-1 text-xs" style={{ border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-primary)" }} />
      <div className="flex gap-2">
        <button type="button" className={botaoClass} style={botaoPerigoStyle} disabled={pending}
          onClick={() => {
            const lista = itens.map((i) => ({ codigo: i.codigo, qtd: Number(qtd[i.codigo] ?? 0) })).filter((i) => i.qtd > 0);
            if (!lista.length) return;
            if (!confirm(`Devolver ${lista.map((l) => `${l.qtd}× ${l.codigo}`).join(", ")} da NF ${numero} para a loja? Sai uma NF de transferência de volta.`)) return;
            run(() => devolverTransferenciaAction(companyId, chave, lista, obs), (d) => `Devolvido: NF 5152 nº ${(d as { numero?: string }).numero ?? ""} de volta para a loja.`, () => setAberto(false));
          }}>
          {pending ? "Emitindo…" : "Confirmar devolução"}
        </button>
        <button type="button" className={botaoClass} style={botaoStyle} onClick={() => setAberto(false)}>Fechar</button>
      </div>
    </div>
  );
}
