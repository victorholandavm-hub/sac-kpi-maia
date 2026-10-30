"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { EmpresaOdoo } from "@/lib/odoo/logisticaTipos";
import type { LocalEstoque, SaldoEstoqueItem, TipoEstoque, TransferenciaEstoques as Resultado } from "@/lib/odoo/logistica";
import { locaisEstoqueAction, saldoEstoqueTipoAction, transferirEstoquesAction } from "@/app/assistencia/logistica/transferencia-estoques-actions";
import { buscarProdutosAction, inventarioSaldoAction } from "@/app/assistencia/logistica/logistica-actions";
import { grupoProduto, type GrupoProduto } from "@/lib/grupoProduto";
import { useAcaoOdoo } from "./useAcaoOdoo";
import { botaoClass, botaoPrimarioStyle, botaoStyle, inputClass, inputStyle } from "./ui";

// 26/10/2026 (Pedro, rotina do Flávio/auditoria): produto do estoque de venda para Avaria ou Assistência, e a volta.
const ROTULO: Record<TipoEstoque, string> = { estoque: "Estoque (venda)", avaria: "Avaria", assistencia: "Assistência" };
// 28/10 (Flávio): mostrar a descrição ao digitar o código e buscar por nome, igual ao inventário.
type Linha = { codigo: string; qtd: string; nome?: string; existe?: boolean; sistema?: number };

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
  // 30/10 (Victor): pesquisar o produto dentro da Avaria/Assistência
  const [filtroVer, setFiltroVer] = useState("");
  const [grupoVer, setGrupoVer] = useState<GrupoProduto | "todos">("todos");
  const [saldo, setSaldo] = useState<SaldoEstoqueItem[] | null>(null);
  const [busca, setBusca] = useState("");
  const [achados, setAchados] = useState<{ codigo: string; nome: string }[]>([]);

  function carregarLocais() {
    locaisEstoqueAction(empresaAtual).then((r) => { if (r.ok) setLocais(r.dados.locais); else showToast(r.erro, "error"); });
  }
  useEffect(carregarLocais, [empresaAtual]); // eslint-disable-line react-hooks/exhaustive-deps
  function ver(t: "avaria" | "assistencia") {
    setVerTipo(t); setSaldo(null); setFiltroVer("");
    saldoEstoqueTipoAction(empresaAtual, t).then((r) => { if (r.ok) setSaldo(r.dados.itens); else showToast(r.erro, "error"); });
  }
  const muda = (n: number, k: "codigo" | "qtd", v: string) => setLinhas((ls) => ls.map((l, i) => (i === n ? { ...l, [k]: v, ...(k === "codigo" ? { nome: undefined, existe: undefined, sistema: undefined } : {}) } : l)));
  async function descrever(ls: Linha[]) {
    const cods = ls.map((l) => l.codigo.trim()).filter(Boolean);
    if (!cods.length) return;
    const r = await inventarioSaldoAction(empresaAtual, cods);
    if (!r.ok) return;
    const por = Object.fromEntries(r.dados.itens.map((i) => [i.codigo, i]));
    setLinhas((atual) => atual.map((l) => { const s = por[l.codigo.trim().toUpperCase()]; return s ? { ...l, nome: s.nome, existe: s.existe, sistema: s.sistema } : l; }));
  }
  async function procurar() {
    const q = busca.trim();
    if (q.length < 2) return;
    const r = await buscarProdutosAction(q);
    if (!r.ok) { showToast(r.erro, "error"); return; }
    setAchados((r.dados ?? []).slice(0, 15).map((p) => ({ codigo: p.codigo, nome: p.nome })));
    if (!(r.dados ?? []).length) showToast("Nenhum produto com esse nome ou código.", "error");
  }
  function incluir(p: { codigo: string; nome: string }) {
    const novas = [...linhas.filter((l) => l.codigo.trim()), ...(linhas.some((l) => l.codigo.trim().toUpperCase() === p.codigo.toUpperCase()) ? [] : [{ codigo: p.codigo, qtd: "1", nome: p.nome }])];
    setLinhas(novas.length ? novas : [{ codigo: "", qtd: "1" }]); setAchados([]); setBusca("");
    void descrever(novas);
  }
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
          {saldo && saldo.length > 0 ? (
            <div className="mt-2 flex gap-2 flex-wrap">
              {(["todos", "estofados", "madeiras"] as const).map((g) => {
                const n = g === "todos" ? saldo.length : saldo.filter((s) => grupoProduto(s.produto) === g).length;
                return (
                  <button key={g} type="button" onClick={() => setGrupoVer(g)} className="rounded-full px-3 py-1 text-xs font-semibold"
                    style={grupoVer === g ? { background: "var(--brand-green)", color: "var(--brand-green-ink)" } : { background: "var(--surface-2)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                    {g === "todos" ? "Todos" : g === "estofados" ? "Estofados" : "Madeiras"} · {n}
                  </button>
                );
              })}
            </div>
          ) : null}
          {saldo && saldo.length > 0 ? (
            <input value={filtroVer} onChange={(e) => setFiltroVer(e.target.value)} placeholder="Pesquisar produto por nome ou código" className="mt-2 w-full rounded-lg px-3 py-1.5 text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          ) : null}
          {saldo === null ? <p>Carregando…</p> : saldo.length === 0 ? <p style={{ color: "var(--text-secondary)" }}>Nenhum produto.</p> : (
            <table className="w-full text-sm mt-2"><tbody>
              {saldo.filter((s) => { const q = filtroVer.trim().toLowerCase(); if (grupoVer !== "todos" && grupoProduto(s.produto) !== grupoVer) return false; return !q || q.split(/\s+/).every((w) => `${s.codigo} ${s.produto}`.toLowerCase().includes(w)); }).map((s) => <tr key={s.codigo}><td style={{ width: 90 }}>{s.codigo}</td><td>{s.produto.replace(/^\[[^\]]*\]\s*/, "")}</td><td className="text-right">{s.qtd}</td>
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
        <div className="flex gap-2 flex-wrap">
          <input value={busca} onChange={(e) => setBusca(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void procurar(); }}
            placeholder="Buscar produto por nome ou código (Enter)" className={inputClass} style={{ ...inputStyle, minWidth: 320 }} />
          <button type="button" className={botaoClass} style={botaoStyle} onClick={() => void procurar()}>Buscar</button>
        </div>
        {achados.length ? (
          <div className="flex flex-col gap-1 text-sm">
            {achados.map((p) => (
              <button key={p.codigo} type="button" onClick={() => incluir(p)} className="text-left hover:underline">+ {p.codigo} — {p.nome.replace(/^\[[^\]]*\]\s*/, "")}</button>
            ))}
          </div>
        ) : null}
        <table className="text-sm"><thead><tr style={{ color: "var(--text-secondary)" }}><th className="text-left">Código</th><th className="text-left">Produto</th><th className="text-left">Quantidade</th><th /></tr></thead>
          <tbody>
            {linhas.map((l, n) => (
              <tr key={n}>
                <td><input className={inputClass} style={{ ...inputStyle, width: 130 }} value={l.codigo} placeholder="071351" onChange={(e) => muda(n, "codigo", e.target.value)}
                  onBlur={() => void descrever(linhas)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void descrever(linhas); } }} /></td>
                <td style={{ color: l.existe === false ? "var(--status-critical)" : undefined, minWidth: 260 }}>
                  {l.existe === false ? "código não encontrado" : l.nome ? <>{l.nome.replace(/^\[[^\]]*\]\s*/, "")}{l.sistema !== undefined ? <span className="text-xs" style={{ color: "var(--text-secondary)" }}> · saldo {l.sistema}</span> : null}</> : ""}
                </td>
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
