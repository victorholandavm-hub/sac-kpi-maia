"use client";
import { useState } from "react";
import { aceitarTransferenciaAction } from "@/app/assistencia/logistica/logistica-actions";
import { useAcaoOdoo } from "./useAcaoOdoo";
import { botaoClass, botaoPrimarioStyle, botaoStyle } from "./ui";

// 29/10 (Antonio/CD + Pedro): "o sistema não pode dar entrada na NF de transferência sozinho". A transferência recebida fica
// AGUARDANDO ACEITE: o CD confere o que chegou e aceita aqui. Quantidade menor = o que faltou volta para a loja de origem por
// uma 5152 de devolução automática (estoque dos dois lados fica certo). Quem aceitou/quando/o que faltou vai para o chatter.
export function AceitarTransferencia({ companyId, pickingId, numero, de, itens }: { companyId: number; pickingId: number; numero: string; de: string; itens: { codigo: string; nome: string; qtd: number }[] }) {
  const { pending, run } = useAcaoOdoo();
  const [aberto, setAberto] = useState(false);
  const [qtd, setQtd] = useState<Record<string, number>>(() => Object.fromEntries(itens.map((i) => [i.codigo, i.qtd])));
  if (!aberto) return <button type="button" className={botaoClass} style={botaoPrimarioStyle} onClick={() => setAberto(true)}>✅ Conferir e aceitar</button>;
  const lista = itens.map((i) => ({ codigo: i.codigo, qtd_recebida: Number(qtd[i.codigo] ?? 0), enviado: i.qtd }));
  const invalido = lista.some((l) => !(l.qtd_recebida >= 0) || l.qtd_recebida > l.enviado);
  const faltou = lista.filter((l) => l.qtd_recebida < l.enviado);
  return (
    <div className="rounded-lg p-2 mt-1 space-y-1" style={{ border: "1px solid var(--border)", background: "var(--surface-1)" }}>
      <div className="text-xs" style={{ color: "var(--text-secondary)" }}>Quantidade que CHEGOU de cada item (padrão = tudo). O que faltar volta para {de} por nota de devolução.</div>
      {itens.map((i) => (
        <label key={i.codigo} className="flex items-center gap-2 text-xs">
          <input type="number" min={0} max={i.qtd} step={1} value={qtd[i.codigo] ?? 0} onChange={(e) => setQtd((q) => ({ ...q, [i.codigo]: Number(e.target.value) }))} className="w-16 rounded px-1 py-0.5" style={{ border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-primary)" }} />
          <span>de {i.qtd} · {i.codigo} {i.nome}</span>
        </label>
      ))}
      {invalido ? <div className="text-xs" style={{ color: "var(--status-critical)" }}>Quantidade recebida não pode ser maior que a enviada.</div> : null}
      <div className="flex gap-2">
        <button type="button" className={botaoClass} style={botaoPrimarioStyle} disabled={pending || invalido}
          onClick={() => {
            const txt = lista.map((l) => `${l.qtd_recebida}× ${l.codigo}${l.qtd_recebida < l.enviado ? ` (faltou ${l.enviado - l.qtd_recebida})` : ""}`).join(", ");
            if (!confirm(`Confirmar o recebimento da NF ${numero} de ${de}: ${txt}?${faltou.length ? "\n\nO que faltou volta para a origem por nota de devolução automática." : ""}`)) return;
            run(() => aceitarTransferenciaAction(companyId, pickingId, lista.map((l) => ({ codigo: l.codigo, qtd_recebida: l.qtd_recebida }))),
              (d) => {
                const r = d as { entrada?: string; devolvido?: { codigo: string; qtd: number }[]; nf_devolucao?: { numero?: string } | null };
                const dv = r.devolvido ?? [];
                return `Entrada feita (${r.entrada ?? ""}): o produto já está no estoque.${dv.length ? ` Faltou ${dv.map((x) => `${x.qtd}× ${x.codigo}`).join(", ")} — voltou para ${de} pela NF de devolução nº ${r.nf_devolucao?.numero ?? ""}.` : ""}`;
              },
              () => setAberto(false));
          }}>
          {pending ? "Aceitando…" : "Confirmar aceite"}
        </button>
        <button type="button" className={botaoClass} style={botaoStyle} onClick={() => setAberto(false)}>Fechar</button>
      </div>
    </div>
  );
}
