"use client";

import { useState } from "react";
import type { NfFornecedor, ParcelaPagar, ProdutoCadastro } from "@/lib/odoo/logistica";
import { buscarProdutosAction, entradaSemPedidoAction, lerNfCdAction, lerNfCdXmlAction } from "@/app/assistencia/logistica/logistica-actions";
import { useAcaoOdoo } from "./useAcaoOdoo";
import { botaoClass, botaoPrimarioStyle, botaoStyle, inputClass, inputStyle } from "./ui";

// 26/10 (Pedro: "tem vez que ele não tem pedido de compra, ele já pode dar entrada direto"):
// chave ou XML -> fornecedor, itens casados com os nossos produtos, boletos -> entrada no estoque do CD + contas a pagar.
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Linha = { cprod: string; nome: string; un: string; qtd: number; preco: number; produto: { id?: number; codigo: string; nome: string } | null; casado_por?: string };

function EscolherProduto({ onEscolher }: { onEscolher: (p: ProdutoCadastro) => void }) {
  const [q, setQ] = useState("");
  const [lista, setLista] = useState<ProdutoCadastro[]>([]);
  const [msg, setMsg] = useState("");
  async function buscar() {
    setMsg("Buscando…");
    const r = await buscarProdutosAction(q);
    if (!r.ok) { setMsg(r.erro); return; }
    setLista(r.dados ?? []); setMsg((r.dados ?? []).length ? "" : "Nenhum produto.");
  }
  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1">
        <input className={inputClass} style={{ ...inputStyle, maxWidth: 220 }} placeholder="código ou nome do nosso produto" value={q}
          onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); buscar(); } }} />
        <button type="button" className={botaoClass} style={botaoStyle} onClick={buscar}>Buscar</button>
      </div>
      {msg ? <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{msg}</span> : null}
      {lista.slice(0, 8).map((p) => (
        <button key={p.id} type="button" className="text-left text-xs underline" style={{ color: "var(--text-primary)" }} onClick={() => { onEscolher(p); setLista([]); }}>
          <b>{p.codigo}</b> {p.nome}
        </button>
      ))}
    </div>
  );
}

export function EntradaSemPedido() {
  const { pending, run } = useAcaoOdoo();
  const [aberto, setAberto] = useState(false);
  const [chave, setChave] = useState("");
  const [nf, setNf] = useState<NfFornecedor | null>(null);
  const [aviso, setAviso] = useState("");
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [parcelas, setParcelas] = useState<ParcelaPagar[]>([]);
  const [emissao, setEmissao] = useState("");
  const [lancarPagar, setLancarPagar] = useState(true);

  function carregar(d: NfFornecedor) {
    if (!d.achou) { setNf(null); setAviso(d.aviso || "Nota não encontrada."); return; }
    setAviso(""); setNf(d); setEmissao(d.emissao || "");
    setLinhas((d.itens ?? []).map((i) => ({ cprod: i.cprod, nome: i.nome, un: i.un, qtd: i.qtd, preco: i.preco, produto: i.produto, casado_por: i.casado_por })));
    setParcelas((d.parcelas ?? []).map((p) => ({ venc: p.venc, valor: p.valor, n: p.n })));
  }
  async function porChave(v: string) {
    setChave(v);
    const c = v.replace(/\D/g, "");
    if (c.length !== 44) return;
    setAviso("Buscando a nota…");
    const r = await lerNfCdAction(c);
    if (!r.ok) { setAviso(r.erro); return; }
    carregar(r.dados);
  }
  async function porXml(f: File | undefined) {
    if (!f) return;
    setAviso("Lendo o XML…");
    const r = await lerNfCdXmlAction(await f.text());
    if (!r.ok) { setAviso(r.erro); return; }
    carregar(r.dados);
  }
  const semProduto = linhas.filter((l) => l.qtd > 0 && !l.produto).length;
  const totalItens = linhas.reduce((a, l) => a + l.qtd * l.preco, 0);

  if (!aberto) {
    return (
      <button type="button" className={botaoClass} style={botaoStyle} onClick={() => setAberto(true)}>
        ＋ Entrada de nota SEM pedido de compra
      </button>
    );
  }
  return (
    <div className="cartao p-4 flex flex-col gap-2 w-full" style={{ border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between gap-2">
        <b>Entrada de nota sem pedido de compra (estoque do CD)</b>
        <button type="button" className={botaoClass} style={botaoStyle} onClick={() => setAberto(false)}>Fechar</button>
      </div>
      <div className="flex gap-2 flex-wrap items-center">
        <input className={inputClass} style={{ ...inputStyle, maxWidth: 440 }} placeholder="Cole a chave de acesso (44 números)" value={chave} onChange={(e) => porChave(e.target.value)} />
        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>ou</span>
        <label className={botaoClass} style={botaoStyle}>
          Subir o XML da nota
          <input type="file" accept=".xml,text/xml,application/xml" style={{ display: "none" }} onChange={(e) => porXml(e.target.files?.[0])} />
        </label>
      </div>
      {aviso ? <p className="text-sm" style={{ color: "var(--status-warning, #B45309)" }}>{aviso}</p> : null}
      {nf ? (
        <>
          <p className="text-sm" style={{ color: "var(--text-primary)" }}>
            <b>NF {nf.numero}/{nf.serie}</b> · {nf.fornecedor?.nome} ({nf.fornecedor?.cnpj}){nf.fornecedor?.novo ? " · fornecedor novo (será cadastrado)" : ""} · total {brl(nf.total || 0)}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase" style={{ color: "var(--text-muted)" }}>
                  <th className="p-1">Item da nota</th><th className="p-1">Qtd</th><th className="p-1">Preço</th><th className="p-1">Nosso produto</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l, i) => (
                  <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                    <td className="p-1 align-top"><span className="text-xs" style={{ color: "var(--text-secondary)" }}>{l.cprod}</span> {l.nome}</td>
                    <td className="p-1 align-top">
                      <input type="number" min={0} step="1" className={inputClass} style={{ ...inputStyle, maxWidth: 90 }} value={l.qtd}
                        onChange={(e) => setLinhas((ls) => ls.map((x, j) => (j === i ? { ...x, qtd: Number(e.target.value) } : x)))} />
                    </td>
                    <td className="p-1 align-top">{brl(l.preco)}</td>
                    <td className="p-1 align-top">
                      {l.produto ? (
                        <span>
                          <b>{l.produto.codigo}</b> {l.produto.nome}
                          {l.casado_por ? <span className="text-xs" style={{ color: "var(--text-secondary)" }}> · por {l.casado_por}</span> : null}{" "}
                          <button type="button" className="text-xs underline" onClick={() => setLinhas((ls) => ls.map((x, j) => (j === i ? { ...x, produto: null } : x)))}>trocar</button>
                        </span>
                      ) : (
                        <EscolherProduto onEscolher={(p) => setLinhas((ls) => ls.map((x, j) => (j === i ? { ...x, produto: { codigo: p.codigo, nome: p.nome }, casado_por: "escolhido" } : x)))} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-1" style={{ borderTop: "1px dashed var(--border)", paddingTop: 6 }}>
            <label className="text-sm flex items-center gap-2">
              <input type="checkbox" checked={lancarPagar} onChange={(e) => setLancarPagar(e.target.checked)} /> <b>Lançar contas a pagar (boletos)</b>
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {parcelas.length ? `${parcelas.length} boleto(s) · ${brl(parcelas.reduce((a, x) => a + (Number(x.valor) || 0), 0))}` : "sem boletos: vence hoje"}
              </span>
            </label>
            {lancarPagar ? (
              <>
                <div className="flex gap-2 items-center text-sm">Emissão <input type="date" className={inputClass} style={{ ...inputStyle, maxWidth: 170 }} value={emissao} onChange={(e) => setEmissao(e.target.value)} /></div>
                {parcelas.map((x, i) => (
                  <div key={i} className="flex gap-2 items-center text-sm">
                    <span style={{ width: 70 }}>Boleto {x.n || i + 1}</span>
                    <input type="date" className={inputClass} style={{ ...inputStyle, maxWidth: 170 }} value={x.venc}
                      onChange={(e) => setParcelas((ps) => ps.map((y, j) => (j === i ? { ...y, venc: e.target.value } : y)))} />
                    <input type="number" step="0.01" min={0} className={inputClass} style={{ ...inputStyle, maxWidth: 140 }} value={x.valor}
                      onChange={(e) => setParcelas((ps) => ps.map((y, j) => (j === i ? { ...y, valor: Number(e.target.value) } : y)))} />
                    <button type="button" className={botaoClass} style={botaoStyle} onClick={() => setParcelas((ps) => ps.filter((_, j) => j !== i))}>✕</button>
                  </div>
                ))}
                <button type="button" className={botaoClass} style={{ ...botaoStyle, alignSelf: "flex-start" }}
                  onClick={() => setParcelas((ps) => [...ps, { venc: "", valor: 0, n: String(ps.length + 1).padStart(3, "0") }])}>＋ boleto</button>
              </>
            ) : null}
          </div>
          <p className="text-sm" style={{ color: semProduto ? "var(--status-critical)" : "var(--text-secondary)" }}>
            {semProduto ? `${semProduto} item(ns) sem o nosso produto: escolha na busca antes de dar entrada.` : `Itens: ${brl(totalItens)}`}
          </p>
          <button type="button" disabled={pending || !!semProduto} className={botaoClass} style={{ ...botaoPrimarioStyle, alignSelf: "flex-start" }}
            onClick={() => {
              if (!nf) return;
              if (!window.confirm(`Dar entrada da NF ${nf.numero} de ${nf.fornecedor?.nome} no estoque do CD${lancarPagar ? " e lançar o contas a pagar" : ""}?`)) return;
              run(() => entradaSemPedidoAction({
                chave: nf.chave, nf: nf.numero, serie: nf.serie, emissao,
                fornecedor: { id: nf.fornecedor?.id ?? false, cnpj: nf.fornecedor?.cnpj ?? "", nome: nf.fornecedor?.nome ?? "" },
                itens: linhas.filter((l) => l.qtd > 0 && l.produto).map((l) => ({ ...(l.produto?.id ? { product_id: l.produto.id } : { codigo: l.produto?.codigo ?? "" }), qtd: l.qtd, preco: l.preco, cprod: l.cprod, nome: l.nome })),
                lancar_pagar: lancarPagar, parcelas,
              }), (d) => `${d.msg} (${d.pedido})` + (d.pagar ? ` · contas a pagar ${d.pagar.conta}: ${d.pagar.parcelas.length} parcela(s)` : "") + (d.aviso_pagar ? ` · ⚠ ${d.aviso_pagar}` : ""),
              () => { setNf(null); setLinhas([]); setParcelas([]); setChave(""); });
            }}>
            {pending ? "Dando entrada…" : "✅ Dar entrada no estoque do CD"}
          </button>
        </>
      ) : null}
    </div>
  );
}
