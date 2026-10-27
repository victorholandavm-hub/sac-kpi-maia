"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { EmpresaOdoo } from "@/lib/odoo/logisticaTipos";
import type { DevolucaoFornecedor as Resultado, NotaEntrada } from "@/lib/odoo/logistica";
import { emitirDevolucaoAction, notaEntradaAction } from "@/app/assistencia/logistica/devolucao-fornecedor-actions";
import { useAcaoOdoo } from "./useAcaoOdoo";
import { botaoClass, botaoPrimarioStyle, botaoStyle, inputClass, inputStyle } from "./ui";

// 27/10/2026 (Edu/CD): devolução ao fornecedor/fábrica. Busca a nota de entrada pela chave (sistema novo ou antigo),
// marca o que volta e emite a NF-e de devolução. Pode juntar itens de várias notas de entrada do MESMO fornecedor.
const ORIGENS: Record<string, string> = { avaria: "Avaria", assistencia: "Assistência", estoque: "Estoque (venda)" };
const brl = (v: number) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function DevolucaoFornecedor({ empresas, empresaAtual }: { empresas: EmpresaOdoo[]; empresaAtual: number }) {
  const router = useRouter(); const pathname = usePathname();
  const { pending, run, showToast } = useAcaoOdoo();
  const [chave, setChave] = useState("");
  const [notas, setNotas] = useState<NotaEntrada[]>([]);
  const [qtd, setQtd] = useState<Record<string, string>>({});
  const [origem, setOrigem] = useState("avaria");
  const [motivo, setMotivo] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  async function buscar() {
    const c = chave.replace(/\D/g, "");
    if (notas.some((n) => n.chave === c)) { showToast("Essa nota já está na lista.", "error"); return; }
    setBuscando(true);
    const r = await notaEntradaAction(c);
    setBuscando(false);
    if (!r.ok) { showToast(r.erro, "error"); return; }
    if (notas.length && notas[0].cnpj !== r.dados.cnpj) { showToast("Essa nota é de outro fornecedor. Uma devolução vai para um fornecedor só.", "error"); return; }
    setNotas((ns) => [...ns, r.dados]); setChave(""); setResultado(null);
  }
  const k = (n: NotaEntrada, i: number) => `${n.chave}|${i}`;
  const itens = notas.flatMap((n) => n.itens.map((it, i) => ({ n, it, q: Number((qtd[k(n, i)] || "0").replace(",", ".")) }))).filter((x) => x.q > 0);
  const total = itens.reduce((a, x) => a + x.q * x.it.preco, 0);

  function emitir() {
    if (!itens.length) { showToast("Informe a quantidade de pelo menos um item.", "error"); return; }
    if (!window.confirm(`Emitir NF-e de DEVOLUÇÃO para ${notas[0].fornecedor}?\n${itens.length} item(ns) · ${brl(total)} · sai de ${ORIGENS[origem]}.\nA nota é transmitida para a SEFAZ.`)) return;
    run(
      () => emitirDevolucaoAction({
        company_id: empresaAtual, origem, fornecedor: notas[0].cnpj, motivo,
        itens: itens.map((x) => ({ codigo: x.it.codigo, qtd: x.q, preco: x.it.preco, icms_percent: x.it.icms_percent,
          ipi_devol: x.it.ipi_valor && x.it.qtd ? Math.round((x.it.ipi_valor / x.it.qtd) * x.q * 100) / 100 : 0, chave_origem: x.n.chave })),
      }),
      (d) => `Devolução emitida: NF-e ${d.numero ?? "?"} (${d.estado ?? ""}).`,
      (d) => { setResultado(d); setNotas([]); setQtd({}); setMotivo(""); },
    );
  }

  return (
    <div className="flex flex-col gap-3" style={{ color: "var(--text-primary)" }}>
      <div className="flex gap-2 flex-wrap items-end">
        <label className="flex flex-col text-sm" style={{ color: "var(--text-secondary)" }}>Loja / CD
          <select value={String(empresaAtual)} onChange={(e) => router.push(`${pathname}?aba=devolucao&empresa=${e.target.value}`)} className={inputClass} style={{ ...inputStyle, minWidth: 220 }}>
            {empresas.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col text-sm" style={{ color: "var(--text-secondary)" }}>Mercadoria sai de
          <select value={origem} onChange={(e) => setOrigem(e.target.value)} className={inputClass} style={{ ...inputStyle, minWidth: 180 }}>
            {Object.entries(ORIGENS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
        </label>
      </div>
      <div className="cartao p-4 flex flex-col gap-2">
        <div className="flex gap-2 flex-wrap items-end">
          <label className="flex flex-col text-sm flex-1" style={{ color: "var(--text-secondary)", minWidth: 280 }}>Chave da nota de ENTRADA (do fornecedor)
            <input value={chave} onChange={(e) => setChave(e.target.value)} onKeyDown={(e) => e.key === "Enter" && buscar()} placeholder="44 números (bipe o código de barras da DANFE)" className={inputClass} style={inputStyle} />
          </label>
          <button type="button" disabled={buscando || chave.replace(/\D/g, "").length !== 44} onClick={buscar} className={botaoClass} style={botaoStyle}>{buscando ? "Buscando…" : "Buscar nota"}</button>
        </div>
        {notas.map((n) => (
          <div key={n.chave} className="mt-2">
            <div className="text-sm"><b>NF {String(n.nf).replace(/^0+/, "")}</b> · {n.fornecedor} · {n.emissao ? n.emissao.split("-").reverse().join("/") : ""} · {brl(n.valor ?? 0)}
              <button type="button" className="text-xs underline ml-2" onClick={() => setNotas((ns) => ns.filter((x) => x.chave !== n.chave))}>tirar</button></div>
            <table className="w-full text-sm mt-1"><thead><tr style={{ color: "var(--text-secondary)" }}><th className="text-left">Código</th><th className="text-left">Produto</th><th className="text-right">Entrou</th><th className="text-right">Já devolvido</th><th className="text-right">Preço</th><th className="text-right">ICMS</th><th className="text-right">Devolver</th></tr></thead>
              <tbody>{n.itens.map((it, i) => (
                <tr key={i}><td>{it.codigo}</td><td>{it.descricao}</td><td className="text-right">{it.qtd}</td><td className="text-right">{it.ja_devolvido || 0}</td>
                  <td className="text-right">{brl(it.preco)}</td><td className="text-right">{it.icms_percent}%</td>
                  <td className="text-right"><input value={qtd[k(n, i)] ?? ""} onChange={(e) => setQtd((q) => ({ ...q, [k(n, i)]: e.target.value }))} inputMode="decimal" placeholder="0" className={inputClass} style={{ ...inputStyle, width: 70 }} /></td></tr>
              ))}</tbody></table>
          </div>
        ))}
        {notas.length ? (
          <>
            <label className="flex flex-col text-sm" style={{ color: "var(--text-secondary)" }}>Motivo
              <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="ex.: avaria no transporte, defeito de fábrica" className={inputClass} style={inputStyle} />
            </label>
            <div className="flex gap-2 items-center flex-wrap">
              <button type="button" disabled={pending || !itens.length} onClick={emitir} className={botaoClass} style={botaoPrimarioStyle}>{pending ? "Emitindo…" : `Emitir devolução (${brl(total)})`}</button>
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Pode bipar outras notas do mesmo fornecedor: tudo sai numa nota só, com a referência de cada uma.</span>
            </div>
          </>
        ) : null}
      </div>
      {resultado ? (
        <div className="cartao p-4 text-sm">
          <b>NF-e de devolução {resultado.numero}</b> · {resultado.estado} · {resultado.fornecedor} · {brl(resultado.valor ?? 0)} · saída {resultado.saida} ({resultado.local})
          {resultado.xml_erro ? <div style={{ color: "var(--status-serious)" }}>Erro: {resultado.xml_erro}</div> : null}
          {resultado.chave ? <div className="mt-2"><a href={`/assistencia/logistica/pdf/nota/${resultado.chave}`} target="_blank" rel="noopener noreferrer" className={botaoClass} style={botaoStyle}>🖨 DANFE</a></div> : null}
        </div>
      ) : null}
    </div>
  );
}
