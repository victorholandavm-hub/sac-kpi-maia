"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { EmpresaOdoo } from "@/lib/odoo/logisticaTipos";
import type { LocalEstoque, SaldoEstoqueItem, TipoEstoque, TransferenciaEstoques as Resultado } from "@/lib/odoo/logistica";
import { locaisEstoqueAction, saldoEstoqueTipoAction, transferirEstoquesAction } from "@/app/assistencia/logistica/transferencia-estoques-actions";
import { useAcaoOdoo } from "./useAcaoOdoo";
import { botaoClass, botaoPrimarioStyle, botaoStyle, inputClass, inputStyle } from "./ui";

// 26/10/2026 (Pedro, rotina do Flávio/auditoria): produto do estoque de venda para Avaria ou Assistência, e a volta.
const ROTULO: Record<TipoEstoque, string> = { estoque: "Estoque (venda)", avaria: "Avaria", assistencia: "Assistência" };
type Linha = { codigo: string; qtd: string };

export function TransferenciaEstoques({ empresas, empresaAtual }: { empresas: EmpresaOdoo[]; empresaAtual: number }) {
  const router = useRouter(); const pathname = usePathname();
  const { pending, run, showToast } = useAcaoOdoo();
  const [locais, setLocais] = useState<LocalEstoque[] | null>(null);
  const [origem, setOrigem] = useState<TipoEstoque>("estoque");
  const [destino, setDestino] = useState<TipoEstoque>("avaria");
  const [linhas, setLinhas] = useState<Linha[]>([{ codigo: "", qtd: "1" }]);
  const [motivo, setMotivo] = useState("");
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [verTipo, setVerTipo] = useState<"avaria" | "assistencia" | null>(null);
  const [saldo, setSaldo] = useState<SaldoEstoqueItem[] | null>(null);

  function carregarLocais() {
    locaisEstoqueAction(empresaAtual).then((r) => { if (r.ok) setLocais(r.dados.locais); else showToast(r.erro, "error"); });
  }
  useEffect(carregarLocais, [empresaAtual]); // eslint-disable-line react-hooks/exhaustive-deps
  function ver(t: "avaria" | "assistencia") {
    setVerTipo(t); setSaldo(null);
    saldoEstoqueTipoAction(empresaAtual, t).then((r) => { if (r.ok) setSaldo(r.dados.itens); else showToast(r.erro, "error"); });
  }
  const muda = (n: number, k: keyof Linha, v: string) => setLinhas((ls) => ls.map((l, i) => (i === n ? { ...l, [k]: v } : l)));
  const prontas = linhas.filter((l) => l.codigo.trim() && Number(l.qtd) > 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 flex-wrap items-end">
        <label className="flex flex-col text-sm" style={{ color: "var(--text-secondary)" }}>Loja / CD
          <select value={String(empresaAtual)} onChange={(e) => router.push(`${pathname}?aba=transferencia&empresa=${e.target.value}`)} className={inputClass} style={{ ...inputStyle, minWidth: 220 }}>
            {empresas.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </label>
      </div>
      <div className="flex gap-2 flex-wrap">
        {(locais ?? []).map((l) => (
          <div key={l.tipo} className="cartao p-3 text-sm" style={{ minWidth: 170, color: "var(--text-primary)" }}>
            <div className="text-xs" style={{ color: "var(--text-secondary)" }}>{ROTULO[l.tipo]}</div>
            <div className="text-lg font-bold">{l.pecas.toLocaleString("pt-BR")} peças</div>
            {l.reservado ? <div className="text-xs" style={{ color: "var(--text-secondary)" }}>{l.reservado} reservadas</div> : null}
            {l.tipo !== "estoque" ? (
              <button type="button" className="text-xs underline" style={{ color: "var(--text-secondary)" }} onClick={() => ver(l.tipo as "avaria" | "assistencia")}>ver produtos</button>
            ) : null}
          </div>
        ))}
        {locais === null ? <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Carregando estoques…</p> : null}
      </div>
      {verTipo ? (
        <div className="cartao p-3 text-sm" style={{ color: "var(--text-primary)" }}>
          <div className="flex justify-between"><b>{ROTULO[verTipo]}: produtos</b><button type="button" className="text-xs underline" onClick={() => setVerTipo(null)}>fechar</button></div>
          {saldo === null ? <p>Carregando…</p> : saldo.length === 0 ? <p style={{ color: "var(--text-secondary)" }}>Nenhum produto.</p> : (
            <table className="w-full text-sm mt-2"><tbody>
              {saldo.map((s) => <tr key={s.codigo}><td style={{ width: 90 }}>{s.codigo}</td><td>{s.produto.replace(/^\[[^\]]*\]\s*/, "")}</td><td className="text-right">{s.qtd}</td>
                <td className="text-right"><button type="button" className="text-xs underline" onClick={() => { setOrigem(verTipo); setDestino("estoque"); setLinhas([{ codigo: s.codigo, qtd: String(s.qtd) }]); }}>devolver ao estoque</button></td></tr>)}
            </tbody></table>
          )}
        </div>
      ) : null}
      <div className="cartao p-4 flex flex-col gap-2" style={{ color: "var(--text-primary)" }}>
        <div className="flex gap-2 flex-wrap items-end text-sm">
          <label className="flex flex-col" style={{ color: "var(--text-secondary)" }}>De
            <select value={origem} onChange={(e) => setOrigem(e.target.value as TipoEstoque)} className={inputClass} style={{ ...inputStyle, minWidth: 170 }}>
              {(Object.keys(ROTULO) as TipoEstoque[]).map((t) => <option key={t} value={t}>{ROTULO[t]}</option>)}
            </select>
          </label>
          <span className="pb-2">→</span>
          <label className="flex flex-col" style={{ color: "var(--text-secondary)" }}>Para
            <select value={destino} onChange={(e) => setDestino(e.target.value as TipoEstoque)} className={inputClass} style={{ ...inputStyle, minWidth: 170 }}>
              {(Object.keys(ROTULO) as TipoEstoque[]).filter((t) => t !== origem).map((t) => <option key={t} value={t}>{ROTULO[t]}</option>)}
            </select>
          </label>
          <input className={inputClass} style={{ ...inputStyle, maxWidth: 380 }} placeholder="Motivo (ex.: avaria no transporte, peça para o chamado 1234)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </div>
        <table className="text-sm"><thead><tr style={{ color: "var(--text-secondary)" }}><th className="text-left">Código</th><th className="text-left">Quantidade</th><th /></tr></thead>
          <tbody>
            {linhas.map((l, n) => (
              <tr key={n}>
                <td><input className={inputClass} style={{ ...inputStyle, width: 130 }} value={l.codigo} placeholder="071351" onChange={(e) => muda(n, "codigo", e.target.value)} /></td>
                <td><input type="number" min={1} step={1} className={inputClass} style={{ ...inputStyle, width: 100 }} value={l.qtd} onChange={(e) => muda(n, "qtd", e.target.value)} /></td>
                <td>{linhas.length > 1 ? <button type="button" className={botaoClass} style={botaoStyle} onClick={() => setLinhas((ls) => ls.filter((_, i) => i !== n))}>✕</button> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex gap-2 flex-wrap">
          <button type="button" className={botaoClass} style={botaoStyle} onClick={() => setLinhas((ls) => [...ls, { codigo: "", qtd: "1" }])}>＋ produto</button>
          <button type="button" className={botaoClass} style={botaoPrimarioStyle} disabled={pending || origem === destino || !prontas.length || motivo.trim().length < 3}
            onClick={() => {
              if (destino === origem) return;
              if (!confirm(`Transferir ${prontas.length} produto(s) de ${ROTULO[origem]} para ${ROTULO[destino]}?`)) return;
              run(() => transferirEstoquesAction({ company_id: empresaAtual, origem, destino, motivo, itens: prontas.map((l) => ({ codigo: l.codigo, qtd: Number(l.qtd) })) }),
                (d) => d.msg,
                (d) => { setResultado(d); setLinhas([{ codigo: "", qtd: "1" }]); carregarLocais(); if (verTipo) ver(verTipo); });
            }}>
            {pending ? "Transferindo…" : `Transferir ${prontas.length ? `(${prontas.length})` : ""}`}
          </button>
        </div>
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Avaria e Assistência não contam como estoque de venda. Só sai o que está livre (o reservado para pedidos fica). Se faltar saldo em algum produto, nada é transferido.
        </p>
      </div>
      {resultado ? (
        <div className="cartao p-3 text-sm" style={{ color: "var(--text-primary)" }}>
          <b>{resultado.picking}</b> · {resultado.de} → {resultado.para}
          <ul className="mt-1">{resultado.itens.map((i) => <li key={i.codigo}>{i.qtd} × {i.codigo} — {i.nome}</li>)}</ul>
        </div>
      ) : null}
    </div>
  );
}
