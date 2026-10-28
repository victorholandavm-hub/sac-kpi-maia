"use client";

import { useState } from "react";
import { buscarProdutosAction, novoAbastAction } from "@/app/assistencia/logistica/logistica-actions";
import type { EmpresaOdoo } from "@/lib/odoo/logisticaTipos";
import { botaoClass, botaoPrimarioStyle, botaoStyle, inputClass, inputStyle } from "./ui";

type Linha = { codigo: string; nome: string; qtd: number };

// 27/10/2026: pedido de transferência da loja ao CD (conferente/estoquista). Só cria o pedido; quem atende é o CD.
export function PedirTransferenciaForm({ lojas }: { lojas: EmpresaOdoo[] }) {
  const [loja, setLoja] = useState<number>(lojas.length === 1 ? lojas[0].id : 0);
  const [busca, setBusca] = useState("");
  const [achados, setAchados] = useState<{ codigo: string; nome: string }[]>([]);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [obs, setObs] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function procurar() {
    const q = busca.trim();
    if (q.length < 3) return;
    const r = await buscarProdutosAction(q);
    setAchados(r.ok ? (r.dados ?? []).slice(0, 12).map((p) => ({ codigo: p.codigo, nome: p.nome })) : []);
    if (!r.ok) setMsg({ ok: false, texto: r.erro });
  }
  function incluir(p: { codigo: string; nome: string }) {
    setLinhas((l) => (l.some((x) => x.codigo === p.codigo) ? l : [...l, { codigo: p.codigo, nome: p.nome, qtd: 1 }]));
    setAchados([]); setBusca("");
  }
  async function enviar() {
    if (!loja) { setMsg({ ok: false, texto: "Escolha a loja." }); return; }
    if (!linhas.length) { setMsg({ ok: false, texto: "Inclua pelo menos um produto." }); return; }
    setEnviando(true); setMsg(null);
    const r = await novoAbastAction(loja, linhas.map((l) => ({ codigo: l.codigo, qtd: l.qtd })), false, obs.trim() || undefined);
    setEnviando(false);
    if (r.ok) { setMsg({ ok: true, texto: "Pedido enviado ao CD." }); setLinhas([]); setObs(""); }
    else setMsg({ ok: false, texto: r.erro });
  }
  return (
    <div className="cartao p-4 flex flex-col gap-3">
      {lojas.length > 1 ? (
        <select value={loja} onChange={(e) => setLoja(Number(e.target.value))} className={inputClass} style={inputStyle}>
          <option value={0}>Loja que vai receber…</option>
          {lojas.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      ) : <p className="text-sm font-semibold">Loja: {lojas[0]?.name ?? "—"}</p>}
      <div className="flex gap-2">
        <input value={busca} onChange={(e) => setBusca(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") procurar(); }}
          placeholder="Código ou nome do produto (Enter para buscar)" className={inputClass} style={inputStyle} />
        <button type="button" onClick={procurar} className={botaoClass} style={botaoStyle}>Buscar</button>
      </div>
      {achados.length ? (
        <div className="flex flex-col gap-1">
          {achados.map((p) => (
            <button key={p.codigo} type="button" onClick={() => incluir(p)} className="text-left text-sm underline-offset-2 hover:underline">
              + {p.codigo} {p.nome}
            </button>
          ))}
        </div>
      ) : null}
      {linhas.map((l, i) => (
        <div key={l.codigo} className="flex items-center gap-2 text-sm">
          <input type="number" min={1} value={l.qtd} onChange={(e) => setLinhas((x) => x.map((y, j) => (j === i ? { ...y, qtd: Math.max(1, Number(e.target.value) || 1) } : y)))}
            className={inputClass} style={{ ...inputStyle, width: 80 }} />
          <span className="flex-1">{l.codigo} {l.nome}</span>
          <button type="button" onClick={() => setLinhas((x) => x.filter((_, j) => j !== i))} className={botaoClass} style={botaoStyle}>tirar</button>
        </div>
      ))}
      <textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Observação para o CD (opcional)" className={inputClass} style={inputStyle} />
      <button type="button" disabled={enviando} onClick={enviar} className={botaoClass} style={botaoPrimarioStyle}>{enviando ? "Enviando…" : "Enviar pedido ao CD"}</button>
      {msg ? <p className="text-sm" style={{ color: msg.ok ? "var(--status-ok, #1B7E3B)" : "var(--status-critical)" }}>{msg.texto}</p> : null}
    </div>
  );
}
