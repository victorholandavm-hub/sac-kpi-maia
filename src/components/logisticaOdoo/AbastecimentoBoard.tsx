"use client";

import { useState } from "react";
import type { SolicitacaoAbast } from "@/lib/odoo/logisticaTipos";
import { atenderAbastAction, cancelarAbastAction } from "@/app/assistencia/logistica/logistica-actions";
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
  const [qtd, setQtd] = useState<Record<string, number>>(() =>
    Object.fromEntries(s.itens.map((i) => [i.codigo, Math.max(0, Math.min(i.qtd, i.saldo_cd))])),
  );
  const obs = semHtml(s.obs || "");
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
                  <b>{i.codigo}</b> {i.nome.slice(0, 60)}
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
      <div className="flex gap-2 flex-wrap">
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
              (d) => `Atendido: transferência ${d.saida ?? ""} · NF ${d.numero ?? ""}`,
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

export function AbastecimentoBoard({ solicitacoes }: { solicitacoes: SolicitacaoAbast[] }) {
  if (!solicitacoes.length) {
    return (
      <div className="cartao p-6 text-sm" style={{ color: "var(--text-secondary)" }}>
        Nenhum pedido de abastecimento aberto.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {solicitacoes.map((s) => (
        <Cartao key={s.id} s={s} />
      ))}
    </div>
  );
}
