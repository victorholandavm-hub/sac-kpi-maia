"use client";

import { useState } from "react";
import type { EmpresaOdoo, SolicitacaoAbast } from "@/lib/odoo/logisticaTipos";
import type { ProdutoCadastro } from "@/lib/odoo/logistica";
import { atenderAbastAction, bloquearProdutoAction, buscarProdutosAction, cancelarAbastAction, editarAbastAction, novoAbastAction } from "@/app/assistencia/logistica/logistica-actions";
import { useAcaoOdoo } from "./useAcaoOdoo";
import { botaoClass, botaoPerigoStyle, botaoPrimarioStyle, botaoStyle, inputClass, inputStyle } from "./ui";

function semHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// 26/10 (Carlos Gabriel): romaneio/lista de separação do pedido da loja, para imprimir antes de carregar
function imprimirSeparacao(s: SolicitacaoAbast, qtd: Record<string, number>) {
  const linhas = s.itens
    .map(
      (i) =>
        `<tr><td>${i.codigo}</td><td>${i.nome}</td><td style="text-align:center">${i.qtd}</td><td style="text-align:center">${i.saldo_cd}</td><td style="text-align:center;font-weight:700">${qtd[i.codigo] ?? 0}</td><td style="width:60px;border-bottom:1px solid #000"></td></tr>`,
    )
    .join("");
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Separação ${s.nome}</title>
<style>body{font-family:Arial,sans-serif;font-size:13px;margin:18px}h1{font-size:18px;margin:0 0 4px}table{border-collapse:collapse;width:100%;margin-top:10px}th,td{border:1px solid #999;padding:5px 6px}th{background:#eee;text-align:left}.m{color:#444;margin:2px 0}@media print{button{display:none}}</style></head><body>
<h1>Lista de separação — abastecimento ${s.loja}</h1>
<p class="m">Pedido ${s.nome} · aberto em ${s.criado.slice(0, 16)} UTC por ${s.solicitante}</p>
${s.obs ? `<p class="m">Obs.: ${s.obs.replace(/<[^>]+>/g, " ")}</p>` : ""}
<table><thead><tr><th>Código</th><th>Produto</th><th>Pedido</th><th>CD tem</th><th>Vai no caminhão</th><th>Conferido</th></tr></thead><tbody>${linhas}</tbody></table>
<p class="m" style="margin-top:18px">Separado por: ______________________ &nbsp; Conferido por: ______________________ &nbsp; Motorista: ______________________</p>
<button onclick="window.print()">Imprimir</button><script>setTimeout(function(){window.print()},300)</script></body></html>`;
  const w = window.open("", "_blank");
  if (!w) {
    alert("O navegador bloqueou a janela de impressão. Libere pop-ups para este site.");
    return;
  }
  w.document.write(html);
  w.document.close();
}

function Cartao({ s }: { s: SolicitacaoAbast }) {
  const { pending, run } = useAcaoOdoo();
  // 26/10 (Eduardo): depois de atender, link para imprimir a DANFE da 5152
  const [nota, setNota] = useState<{ numero?: string | number; chave?: string } | null>(null);
  const [qtd, setQtd] = useState<Record<string, number>>(() =>
    Object.fromEntries(s.itens.map((i) => [i.codigo, Math.max(0, Math.min(i.qtd, i.saldo_cd))])),
  );
  const obs = semHtml(s.obs || "");
  // 28/10 (Pedro): editar o pedido da loja — incluir/tirar produto e mudar a quantidade pedida (grava no pedido, a loja vê na hora)
  const [editando, setEditando] = useState<{ codigo: string; nome: string; qtd: number }[] | null>(null);
  const [busca, setBusca] = useState("");
  const [achados, setAchados] = useState<{ codigo: string; nome: string; cd: number }[]>([]);
  async function procurar() {
    if (busca.trim().length < 2) return;
    const r = await buscarProdutosAction(busca.trim());
    setAchados(r.ok ? (r.dados ?? []).slice(0, 12).map((p) => ({ codigo: p.codigo, nome: p.nome, cd: p.disponivel_cd ?? p.estoque_cd ?? 0 })) : []);
  }
  return (
    <div className="cartao p-4 flex flex-col gap-3">
      <div className="flex justify-between gap-2 flex-wrap">
        <b style={{ color: "var(--text-primary)" }}>
          {s.loja} · {s.nome}
        </b>
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {s.criado.slice(0, 16)} UTC · {s.solicitante}
        </span>
      </div>
      {obs ? (
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          obs: {obs}
        </p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ color: "var(--text-secondary)" }}>
              <th className="text-left py-1">Produto</th>
              <th>Pedido</th>
              <th>CD tem</th>
              <th>Loja tem</th>
              <th>Vai no caminhão</th>
            </tr>
          </thead>
          <tbody>
            {s.itens.map((i) => (
              <tr key={i.codigo} style={{ color: "var(--text-primary)" }}>
                <td className="py-1">
                  <b>{i.codigo}</b> {i.nome.slice(0, 60)}{" "}
                  <button
                    type="button"
                    className="text-xs underline"
                    style={{ color: "var(--status-critical)" }}
                    disabled={pending}
                    title="Bloquear este produto para as lojas: some da busca e não pode mais ser pedido"
                    onClick={() => {
                      const m = window.prompt(`Bloquear ${i.codigo} para as lojas? Escreva o motivo (ex.: código errado, use 0xxxxx):`);
                      if (m === null) return;
                      run(() => bloquearProdutoAction(i.codigo, m), `Produto ${i.codigo} bloqueado para as lojas.`);
                    }}
                  >
                    bloquear
                  </button>
                </td>
                <td className="text-center">{i.qtd}</td>
                <td className="text-center" style={{ color: i.saldo_cd >= i.qtd ? "var(--status-ok, #1B7E3B)" : "var(--status-critical)" }}>
                  {i.saldo_cd}
                </td>
                <td className="text-center">{i.saldo_loja}</td>
                <td className="text-center">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    className={inputClass}
                    style={{ ...inputStyle, width: 80 }}
                    value={qtd[i.codigo] ?? 0}
                    onChange={(e) => setQtd((q) => ({ ...q, [i.codigo]: Number(e.target.value) }))}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editando ? (
        <div className="cartao p-3 flex flex-col gap-2" style={{ color: "var(--text-primary)", border: "2px solid var(--brand-green, #1B7E3B)" }}>
          <b>Editar o pedido da loja</b>
          {editando.map((l, n) => (
            <div key={l.codigo} className="flex gap-2 items-center text-sm flex-wrap">
              <span style={{ minWidth: 320 }}><b>{l.codigo}</b> {l.nome.slice(0, 60)}</span>
              <input type="number" min={1} step={1} className={inputClass} style={{ ...inputStyle, width: 80 }} value={l.qtd}
                onChange={(e) => setEditando((ls) => (ls ?? []).map((x, j) => (j === n ? { ...x, qtd: Number(e.target.value) } : x)))} />
              <button type="button" className="text-xs underline" style={{ color: "var(--status-critical)" }}
                onClick={() => setEditando((ls) => (ls ?? []).filter((_, j) => j !== n))}>tirar</button>
            </div>
          ))}
          <div className="flex gap-2 flex-wrap">
            <input value={busca} onChange={(e) => setBusca(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void procurar(); }}
              placeholder="Incluir produto: nome ou código (Enter)" className={inputClass} style={{ ...inputStyle, minWidth: 300 }} />
            <button type="button" className={botaoClass} style={botaoStyle} onClick={() => void procurar()}>Buscar</button>
          </div>
          {achados.map((p) => (
            <button key={p.codigo} type="button" className="text-left text-sm hover:underline"
              onClick={() => { setEditando((ls) => ((ls ?? []).some((x) => x.codigo === p.codigo) ? ls : [...(ls ?? []), { codigo: p.codigo, nome: p.nome, qtd: 1 }])); setAchados([]); setBusca(""); }}>
              + {p.codigo} {p.nome} <span className="text-xs" style={{ color: "var(--text-secondary)" }}>(CD tem {p.cd})</span>
            </button>
          ))}
          <div className="flex gap-2 flex-wrap">
            <button type="button" className={botaoClass} style={botaoPrimarioStyle} disabled={pending || !editando.length}
              onClick={() => run(() => editarAbastAction(s.id, editando.map((l) => ({ codigo: l.codigo, qtd: l.qtd }))), (d) => d.msg ?? "Pedido alterado.", () => setEditando(null))}>
              {pending ? "Salvando…" : "💾 Salvar pedido"}
            </button>
            <button type="button" className={botaoClass} style={botaoStyle} onClick={() => { setEditando(null); setAchados([]); }}>Desistir</button>
          </div>
        </div>
      ) : null}
      {nota ? (
        <div className="cartao p-3 flex items-center gap-3 flex-wrap" style={{ background: "var(--brand-green-soft)" }}>
          <b style={{ color: "var(--text-primary)" }}>NF 5152 nº {nota.numero ?? ""} emitida.</b>
          {nota.chave ? (
            <a href={`/assistencia/logistica/pdf/nota/${nota.chave}`} target="_blank" rel="noopener noreferrer" className={botaoClass} style={botaoPrimarioStyle}>
              🖨 Imprimir DANFE (A4)
            </a>
          ) : (
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
              A nota ainda não foi autorizada; abra o Odoo › Fiscal para imprimir.
            </span>
          )}
        </div>
      ) : null}
      <div className="flex gap-2 flex-wrap">
        <button type="button" className={botaoClass} style={botaoStyle} disabled={pending || !!editando}
          onClick={() => setEditando(s.itens.map((i) => ({ codigo: i.codigo, nome: i.nome, qtd: i.qtd })))}>
          ✏️ Editar pedido (incluir / tirar produto)
        </button>
        <button type="button" className={botaoClass} style={botaoStyle} onClick={() => imprimirSeparacao(s, qtd)}>
          🖨️ Imprimir lista de separação
        </button>
        <button
          type="button"
          className={botaoClass}
          style={botaoPrimarioStyle}
          disabled={pending}
          onClick={() => {
            if (!confirm(`Atender o pedido ${s.nome} e emitir a NF de transferência para ${s.loja}?`)) return;
            run(
              () => atenderAbastAction(s.id, Object.entries(qtd).map(([codigo, q]) => ({ codigo, qtd: q }))),
              (d) => `Atendido: transferência ${d.saida ?? ""} · NF 5152 nº ${d.transferencia?.numero ?? d.numero ?? ""}`,
              (d) => setNota({ numero: d.transferencia?.numero ?? d.numero, chave: d.transferencia?.chave }),
            );
          }}
        >
          {pending ? "Emitindo a nota…" : "✅ Atender (sai a NF de transferência)"}
        </button>
        <button
          type="button"
          className={botaoClass}
          style={botaoPerigoStyle}
          disabled={pending}
          onClick={() => {
            const m = prompt("Motivo do cancelamento:", "");
            if (m === null) return;
            run(() => cancelarAbastAction(s.id, m), "Pedido cancelado.");
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// 26/10 (Pedro/Eduardo): o CD inclui um pedido para qualquer loja e pode já faturar (NF 5152)
function NovoPedido({ empresas }: { empresas: EmpresaOdoo[] }) {
  const { pending, run } = useAcaoOdoo();
  const [aberto, setAberto] = useState(false);
  const [loja, setLoja] = useState(0);
  const [q, setQ] = useState("");
  const [achados, setAchados] = useState<ProdutoCadastro[]>([]);
  const [linhas, setLinhas] = useState<{ codigo: string; nome: string; qtd: number; cd: number }[]>([]);
  const lojas = empresas.filter((e) => /^2\d\d /.test(e.name) && !/^213 /.test(e.name)).sort((a, b) => a.name.localeCompare(b.name));
  async function buscar() {
    if (q.trim().length < 2) return;
    const r = await buscarProdutosAction(q.trim());
    setAchados(r.ok && r.dados ? r.dados.filter((p) => p.ativo) : []);
  }
  function incluir(atender: boolean) {
    const nome = lojas.find((l) => l.id === loja)?.name ?? "a loja";
    if (atender && !confirm(`Incluir o pedido para ${nome} e JÁ emitir a NF de transferência (5152)?`)) return;
    run(
      () => novoAbastAction(loja, linhas.map((l) => ({ codigo: l.codigo, qtd: l.qtd })), atender),
      (d) => (atender ? `Pedido ${d.solicitacao?.nome ?? ""} incluído e faturado: NF 5152 nº ${d.transferencia?.numero ?? d.numero ?? ""}` : `Pedido ${d.solicitacao?.nome ?? ""} incluído para ${nome}. Ele aparece na lista abaixo para atender.`),
      () => { setLinhas([]); setAchados([]); setQ(""); setAberto(false); },
    );
  }
  if (!aberto)
    return (
      <div>
        <button type="button" className={botaoClass} style={botaoPrimarioStyle} onClick={() => setAberto(true)}>+ Novo pedido para loja</button>
      </div>
    );
  return (
    <div className="cartao p-4 flex flex-col gap-2">
      <h3 className="font-bold" style={{ color: "var(--text-primary)" }}>Novo pedido de abastecimento</h3>
      <select className={inputClass} style={{ ...inputStyle, maxWidth: 320 }} value={loja} onChange={(e) => setLoja(Number(e.target.value))}>
        <option value={0}>Escolha a loja…</option>
        {lojas.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
      </select>
      <div className="flex gap-2 flex-wrap">
        <input className={inputClass} style={{ ...inputStyle, maxWidth: 360 }} placeholder="Produto: código ou nome" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); buscar(); } }} />
        <button type="button" className={botaoClass} style={botaoStyle} onClick={buscar}>Buscar</button>
      </div>
      {achados.length ? (
        <div className="flex flex-col gap-1 text-sm" style={{ maxHeight: 220, overflowY: "auto" }}>
          {achados.map((p) => (
            <button key={p.id} type="button" className="text-left underline" onClick={() => { setLinhas((ls) => (ls.some((x) => x.codigo === p.codigo) ? ls : [...ls, { codigo: p.codigo, nome: p.nome, qtd: 1, cd: p.disponivel_cd ?? p.estoque_cd }])); }}>
              <b>{p.codigo}</b> {p.nome} <span style={{ color: "var(--text-secondary)" }}>(CD disp. {p.disponivel_cd ?? p.estoque_cd})</span>
            </button>
          ))}
        </div>
      ) : null}
      {linhas.map((l, i) => (
        <div key={l.codigo} className="flex gap-2 items-center text-sm">
          <span style={{ flex: 1 }}><b>{l.codigo}</b> {l.nome} <span style={{ color: "var(--text-secondary)" }}>(CD {l.cd})</span></span>
          <input type="number" min={1} className={inputClass} style={{ ...inputStyle, maxWidth: 90 }} value={l.qtd} onChange={(e) => setLinhas((ls) => ls.map((x, j) => (j === i ? { ...x, qtd: Number(e.target.value) } : x)))} />
          <button type="button" className={botaoClass} style={botaoStyle} onClick={() => setLinhas((ls) => ls.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <div className="flex gap-2 flex-wrap">
        <button type="button" disabled={pending || !loja || !linhas.length} className={botaoClass} style={botaoStyle} onClick={() => incluir(false)}>Só incluir</button>
        <button type="button" disabled={pending || !loja || !linhas.length} className={botaoClass} style={botaoPrimarioStyle} onClick={() => incluir(true)}>{pending ? "Emitindo a nota…" : "Incluir e faturar (5152)"}</button>
        <button type="button" disabled={pending} className={botaoClass} style={botaoStyle} onClick={() => setAberto(false)}>Fechar</button>
      </div>
    </div>
  );
}

export function AbastecimentoBoard({ solicitacoes, empresas = [] }: { solicitacoes: SolicitacaoAbast[]; empresas?: EmpresaOdoo[] }) {
  if (!solicitacoes.length) {
    return (
      <div className="flex flex-col gap-3">
        <NovoPedido empresas={empresas} />
        <div className="cartao p-6 text-sm" style={{ color: "var(--text-secondary)" }}>
          Nenhum pedido de abastecimento aberto.
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <NovoPedido empresas={empresas} />
      {solicitacoes.map((s) => (
        <Cartao key={`${s.id}-${s.itens.map((i) => i.codigo + ":" + i.qtd).join(",")}`} s={s} />
      ))}
    </div>
  );
}
