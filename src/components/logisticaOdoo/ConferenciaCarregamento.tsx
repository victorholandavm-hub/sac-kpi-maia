"use client";

import { useState } from "react";
import type { CargaDetalhe } from "@/lib/odoo/logisticaTipos";
import { botaoClass, botaoLaranjaStyle, botaoStyle, inputClass, inputStyle } from "./ui";

// 26/10/2026 (Pedro): "a entrega parcial é no ato do faturamento da carga: depois do romaneio de separação, quem montou
// volta dizendo o que carregou; por cubagem ou falta pode ir só um item do pedido". Antes de Sair em rota, o CD confirma
// item a item o que foi no caminhão. O que não foi volta para a fila da Expedição (e a NF 5117 sai só do que foi).
export type Parciais = Record<string, { codigo: string; qtd: number }[]>;
type Linha = { pedido_id: number; pedido: string; picking: string; cliente: string; codigo: string; nome: string; qtd: number; carregada: string };

export function ConferenciaCarregamento({ carga, onConfirmar, onCancelar, pending }: { carga: CargaDetalhe; onConfirmar: (parciais: Parciais | null) => void; onCancelar: () => void; pending: boolean }) {
  const [linhas, setLinhas] = useState<Linha[]>(() =>
    carga.paradas.flatMap((p) => p.pickings.flatMap((pk) => (pk.itens ?? []).map((i) => ({ pedido_id: pk.pedido_id || 0, pedido: pk.pedido, picking: pk.nome, cliente: p.cliente, codigo: i.codigo, nome: i.nome, qtd: i.qtd, carregada: String(i.qtd) })))),
  );
  const muda = (n: number, v: string) => setLinhas((ls) => ls.map((l, i) => (i === n ? { ...l, carregada: v } : l)));
  const reduzidas = linhas.filter((l) => Number(l.carregada) < l.qtd);
  const zeradas = Object.values(linhas.reduce<Record<string, Linha[]>>((acc, l) => ((acc[l.picking] ??= []).push(l), acc), {})).filter((ls) => ls.every((l) => Number(l.carregada) <= 0));
  function confirmar() {
    if (zeradas.length) {
      window.alert(`Nenhum item carregado de ${zeradas.map((ls) => ls[0].pedido).join(", ")}. Para não levar o pedido inteiro, use "Remover da carga" na entrega.`);
      return;
    }
    if (linhas.some((l) => Number(l.carregada) > l.qtd || Number(l.carregada) < 0 || Number.isNaN(Number(l.carregada)))) {
      window.alert("Quantidade carregada inválida (tem que ser entre 0 e o pedido).");
      return;
    }
    if (!reduzidas.length) return onConfirmar(null);
    const parciais: Parciais = {};
    for (const l of linhas) {
      if (!reduzidas.some((r) => r.picking === l.picking)) continue;
      (parciais[String(l.pedido_id)] ??= []).push({ codigo: l.codigo, qtd: Number(l.carregada) });
    }
    onConfirmar(parciais);
  }
  return (
    <div className="cartao p-4 flex flex-col gap-3" style={{ border: "2px solid var(--brand-orange)" }}>
      <b style={{ color: "var(--text-primary)" }}>Conferência do carregamento · o que foi no caminhão</b>
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        Confira com o romaneio de separação. Diminua a quantidade do que não coube ou faltou: esse resto volta para a fila da Expedição e a nota de entrega sai só do que foi.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ color: "var(--text-primary)" }}>
          <thead><tr style={{ color: "var(--text-secondary)" }}><th className="text-left">Cliente · pedido</th><th className="text-left">Produto</th><th>Pedido</th><th>Carregado</th><th></th></tr></thead>
          <tbody>
            {linhas.map((l, n) => (
              <tr key={n} style={{ background: Number(l.carregada) < l.qtd ? "color-mix(in srgb, var(--brand-orange) 12%, transparent)" : undefined }}>
                <td className="py-1">{l.cliente.slice(0, 28)}<br /><span className="text-xs" style={{ color: "var(--text-secondary)" }}>{l.pedido}</span></td>
                <td><b>{l.codigo}</b> {l.nome.replace(/^\[[^\]]*\]\s*/, "").slice(0, 48)}</td>
                <td className="text-center">{l.qtd}</td>
                <td className="text-center"><input type="number" min={0} max={l.qtd} step={1} className={inputClass} style={{ ...inputStyle, width: 80 }} value={l.carregada} onChange={(e) => muda(n, e.target.value)} /></td>
                <td><button type="button" className="text-xs underline" style={{ color: "var(--status-critical)" }} onClick={() => muda(n, "0")}>não carregou</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2 flex-wrap items-center">
        <button type="button" className={botaoClass} style={botaoLaranjaStyle} disabled={pending} onClick={confirmar}>
          {pending ? "Emitindo as notas…" : reduzidas.length ? `Sair em rota com ${reduzidas.length} item(ns) a menos · emite as NF 5117` : "Tudo carregado · Sair em rota · emite as NF 5117"}
        </button>
        <button type="button" className={botaoClass} style={botaoStyle} disabled={pending} onClick={onCancelar}>Voltar</button>
        {reduzidas.length ? <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{reduzidas.length} linha(s) com menos do que o pedido — o resto volta para a Expedição.</span> : null}
      </div>
    </div>
  );
}
