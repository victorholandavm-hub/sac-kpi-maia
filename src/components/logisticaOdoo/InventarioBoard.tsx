"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { EmpresaOdoo } from "@/lib/odoo/logisticaTipos";
import type { ItemInventarioSaldo } from "@/lib/odoo/logistica";
import { inventarioAplicarAction, inventarioSaldoAction } from "@/app/assistencia/logistica/logistica-actions";
import { useAcaoOdoo } from "./useAcaoOdoo";
import { botaoClass, botaoPrimarioStyle, botaoStyle, inputClass, inputStyle } from "./ui";

type Linha = { codigo: string; contado: string; nome?: string; existe?: boolean; estocavel?: boolean; sistema?: number };

export function InventarioBoard({ empresas, empresaAtual }: { empresas: EmpresaOdoo[]; empresaAtual: number }) {
  const router = useRouter(); const pathname = usePathname();
  const { pending, run, showToast } = useAcaoOdoo();
  const [linhas, setLinhas] = useState<Linha[]>([{ codigo: "", contado: "" }]);
  const [motivo, setMotivo] = useState("");
  const [resultado, setResultado] = useState<{ codigo: string; nome: string; antes: number; depois: number; ajuste: number }[] | null>(null);
  const muda = (n: number, k: "codigo" | "contado", v: string) => setLinhas((ls) => ls.map((l, i) => (i === n ? { ...l, [k]: v, ...(k === "codigo" ? { sistema: undefined, existe: undefined } : {}) } : l)));
  async function conferir() {
    const r = await inventarioSaldoAction(empresaAtual, linhas.map((l) => l.codigo));
    if (!r.ok) { showToast(r.erro, "error"); return; }
    const por: Record<string, ItemInventarioSaldo> = Object.fromEntries(r.dados.itens.map((i) => [i.codigo, i]));
    setLinhas((ls) => ls.map((l) => { const s = por[l.codigo.trim().toUpperCase()]; return s ? { ...l, nome: s.nome, existe: s.existe, estocavel: s.estocavel, sistema: s.sistema } : l; }));
  }
  const prontas = linhas.filter((l) => l.codigo.trim() && l.contado !== "" && l.existe && l.estocavel);
  const difs = prontas.filter((l) => Number(l.contado) !== (l.sistema ?? NaN));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 flex-wrap items-end">
        <label className="flex flex-col text-sm" style={{ color: "var(--text-secondary)" }}>Loja / CD
          <select value={String(empresaAtual)} onChange={(e) => router.push(`${pathname}?empresa=${e.target.value}`)} className={inputClass} style={{ ...inputStyle, minWidth: 220 }}>
            {empresas.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </label>
        <input className={inputClass} style={{ ...inputStyle, maxWidth: 360 }} placeholder="Motivo (ex.: contagem mensal, acerto de avaria)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </div>
      <div className="cartao p-4 overflow-x-auto">
        <table className="w-full text-sm" style={{ color: "var(--text-primary)" }}>
          <thead><tr style={{ color: "var(--text-secondary)" }}><th className="text-left">Código</th><th className="text-left">Produto</th><th>Sistema</th><th>Contado</th><th>Diferença</th></tr></thead>
          <tbody>
            {linhas.map((l, n) => {
              const d = l.sistema !== undefined && l.contado !== "" ? Number(l.contado) - l.sistema : null;
              return (
                <tr key={n}>
                  <td><input className={inputClass} style={{ ...inputStyle, width: 120 }} value={l.codigo} placeholder="071351" onChange={(e) => muda(n, "codigo", e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void conferir(); } }} /></td>
                  <td style={{ color: l.existe === false ? "var(--status-critical)" : undefined }}>
                    {l.existe === false ? "não existe no Odoo" : l.estocavel === false ? `${l.nome} — não controla estoque (avise o cadastro)` : (l.nome ?? "")}
                  </td>
                  <td className="text-center">{l.sistema ?? "—"}</td>
                  <td className="text-center"><input type="number" min={0} step={1} className={inputClass} style={{ ...inputStyle, width: 90 }} value={l.contado} onChange={(e) => muda(n, "contado", e.target.value)} /></td>
                  <td className="text-center" style={{ color: d ? (d > 0 ? "var(--status-ok, #1B7E3B)" : "var(--status-critical)") : undefined, fontWeight: d ? 700 : 400 }}>{d === null ? "—" : d > 0 ? `+${d}` : d}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2 flex-wrap">
        <button type="button" className={botaoClass} style={botaoStyle} onClick={() => setLinhas((ls) => [...ls, { codigo: "", contado: "" }])}>＋ produto</button>
        <button type="button" className={botaoClass} style={botaoStyle} disabled={pending} onClick={() => void conferir()}>Conferir saldo do sistema</button>
        <button type="button" className={botaoClass} style={botaoPrimarioStyle} disabled={pending || !difs.length}
          onClick={() => {
            if (!confirm(`Aplicar a contagem em ${difs.length} produto(s)? O estoque do sistema passa a ser o contado.`)) return;
            run(() => inventarioAplicarAction(empresaAtual, difs.map((l) => ({ codigo: l.codigo.trim().toUpperCase(), contado: Number(l.contado) })), motivo),
              (d) => { setResultado(d.itens); if (d.erros.length) showToast(d.erros.join(" · "), "error"); return `${d.ajustados} produto(s) ajustado(s).`; });
          }}>
          {pending ? "Aplicando…" : `✅ Aplicar contagem (${difs.length} com diferença)`}
        </button>
        <button type="button" className={botaoClass} style={botaoStyle} onClick={() => { setLinhas([{ codigo: "", contado: "" }]); setResultado(null); }}>Limpar</button>
      </div>
      {resultado ? (
        <div className="cartao p-4 text-sm" style={{ color: "var(--text-primary)" }}>
          <b>Aplicado:</b>
          <ul>{resultado.map((r) => <li key={r.codigo}>{r.codigo} {r.nome.slice(0, 50)}: {r.antes} → {r.depois} ({r.ajuste > 0 ? "+" : ""}{r.ajuste})</li>)}</ul>
        </div>
      ) : null}
    </div>
  );
}
