"use client";

import { useState } from "react";
import type { ProdutoCadastro } from "@/lib/odoo/logistica";
import { alterarProdutoAction, buscarProdutosAction, criarProdutoAction } from "@/app/assistencia/logistica/logistica-actions";
import { useAcaoOdoo } from "./useAcaoOdoo";
import { Chip, botaoClass, botaoPrimarioStyle, botaoStyle, inputClass, inputStyle } from "./ui";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Linha({ p, onSalvo }: { p: ProdutoCadastro; onSalvo: (n: ProdutoCadastro) => void }) {
  const { pending, run } = useAcaoOdoo();
  const [preco, setPreco] = useState(String(p.preco));
  const [nome, setNome] = useState(p.nome);
  const [ncm, setNcm] = useState(p.ncm);
  const [ean, setEan] = useState(p.ean);
  const mudou = Number(preco) !== p.preco || nome !== p.nome || ncm !== p.ncm || ean !== p.ean;
  return (
    <tr style={{ borderBottom: "1px solid var(--border)", opacity: p.ativo ? 1 : 0.6 }}>
      <td className="p-2 align-top whitespace-nowrap"><b>{p.codigo}</b>{!p.ativo ? <div><Chip cor="var(--status-critical)">bloqueado</Chip></div> : null}</td>
      <td className="p-2 align-top"><input className={inputClass} style={{ ...inputStyle, minWidth: 280 }} value={nome} onChange={(e) => setNome(e.target.value)} /></td>
      <td className="p-2 align-top"><input type="number" step="0.01" min={0} className={inputClass} style={{ ...inputStyle, maxWidth: 130 }} value={preco} onChange={(e) => setPreco(e.target.value)} /></td>
      <td className="p-2 align-top text-xs" style={{ color: "var(--text-secondary)" }}>{brl(p.custo)}</td>
      <td className="p-2 align-top"><input className={inputClass} style={{ ...inputStyle, maxWidth: 120 }} value={ncm} onChange={(e) => setNcm(e.target.value)} /></td>
      <td className="p-2 align-top"><input className={inputClass} style={{ ...inputStyle, maxWidth: 150 }} value={ean} onChange={(e) => setEan(e.target.value)} placeholder="EAN" /></td>
      <td className="p-2 align-top text-center">{p.estoque_cd}</td>
      <td className="p-2 align-top whitespace-nowrap">
        <button type="button" disabled={pending || !mudou} className={botaoClass} style={botaoPrimarioStyle}
          onClick={() => run(() => alterarProdutoAction(p.id, { preco: Number(preco), nome, ncm, ean }), (d) => (d.mudou?.length ? `${p.codigo}: ${d.mudou.join("; ")}` : "Nada mudou."), (d) => onSalvo(d.produto))}>
          {pending ? "Salvando…" : "Salvar"}
        </button>{" "}
        <button type="button" disabled={pending} className={botaoClass} style={botaoStyle}
          onClick={() => { if (!confirm(p.ativo ? `Bloquear ${p.codigo} para venda?` : `Liberar ${p.codigo} para venda?`)) return;
            run(() => alterarProdutoAction(p.id, { ativo: !p.ativo }), p.ativo ? "Produto bloqueado para venda." : "Produto liberado.", (d) => onSalvo(d.produto)); }}>
          {p.ativo ? "Bloquear" : "Liberar"}
        </button>
      </td>
    </tr>
  );
}

export function ProdutosBoard() {
  const { pending, run } = useAcaoOdoo();
  const [q, setQ] = useState("");
  const [lista, setLista] = useState<ProdutoCadastro[]>([]);
  const [novo, setNovo] = useState({ codigo: "", nome: "", preco: "", ncm: "", ean: "", custo: "" });
  function buscar() {
    run(() => buscarProdutosAction(q), undefined, (l) => setLista(l));
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="cartao p-4 flex gap-2 flex-wrap items-center">
        <input className={inputClass} style={{ ...inputStyle, minWidth: 320 }} placeholder="Código, nome ou EAN (ex.: 070357, balcão dakota)" value={q}
          onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") buscar(); }} />
        <button type="button" className={botaoClass} style={botaoPrimarioStyle} disabled={pending} onClick={buscar}>{pending ? "Buscando…" : "Buscar"}</button>
      </div>
      {lista.length ? (
        <div className="cartao p-0 overflow-x-auto">
          <table className="w-full text-sm min-w-[980px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide" style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
                <th className="p-2">Código</th><th className="p-2">Nome</th><th className="p-2">Preço (tabela)</th><th className="p-2">Custo</th>
                <th className="p-2">NCM</th><th className="p-2">EAN</th><th className="p-2">Estoque CD</th><th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {lista.map((p) => (
                <Linha key={p.id + p.alterado} p={p} onSalvo={(n) => setLista((l) => l.map((x) => (x.id === n.id ? n : x)))} />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <div className="cartao p-4 flex flex-col gap-2">
        <h3 className="font-bold" style={{ color: "var(--text-primary)" }}>Cadastrar produto novo</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <input className={inputClass} style={inputStyle} placeholder="Código (ex.: 071999)" value={novo.codigo} onChange={(e) => setNovo({ ...novo, codigo: e.target.value })} />
          <input className={inputClass} style={inputStyle} placeholder="Nome completo (como vai na nota)" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} />
          <input type="number" step="0.01" min={0} className={inputClass} style={inputStyle} placeholder="Preço de venda (tabela)" value={novo.preco} onChange={(e) => setNovo({ ...novo, preco: e.target.value })} />
          <input className={inputClass} style={inputStyle} placeholder="NCM (8 números, ex.: 9403.60.00)" value={novo.ncm} onChange={(e) => setNovo({ ...novo, ncm: e.target.value })} />
          <input className={inputClass} style={inputStyle} placeholder="EAN / código de barras (opcional)" value={novo.ean} onChange={(e) => setNovo({ ...novo, ean: e.target.value })} />
          <input type="number" step="0.01" min={0} className={inputClass} style={inputStyle} placeholder="Custo (opcional)" value={novo.custo} onChange={(e) => setNovo({ ...novo, custo: e.target.value })} />
        </div>
        <button type="button" className={botaoClass} style={{ ...botaoPrimarioStyle, alignSelf: "flex-start" }} disabled={pending}
          onClick={() => run(() => criarProdutoAction({ codigo: novo.codigo, nome: novo.nome, preco: Number(novo.preco), ncm: novo.ncm, ean: novo.ean || undefined, custo: novo.custo ? Number(novo.custo) : undefined }),
            (d) => `Produto ${d.produto.codigo} cadastrado. O preço chega ao coach e ao site em até 10 minutos.`,
            (d) => { setLista([d.produto]); setNovo({ codigo: "", nome: "", preco: "", ncm: "", ean: "", custo: "" }); })}>
          {pending ? "Cadastrando…" : "＋ Cadastrar produto"}
        </button>
      </div>
    </div>
  );
}
