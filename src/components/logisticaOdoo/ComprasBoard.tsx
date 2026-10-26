"use client";

import { useState } from "react";
import Link from "next/link";
import type { FornecedorOdoo, NfChave, ParcelaPagar, PedidoCompra } from "@/lib/odoo/logistica";
import {
  buscarFornecedoresAction,
  buscarNfChaveAction,
  cancelarCompraAction,
  criarCompraAction,
  entradaCompraAction,
  previsaoCompraAction,
} from "@/app/assistencia/logistica/logistica-actions";
import { useAcaoOdoo } from "./useAcaoOdoo";
import { EntradaSemPedido } from "./EntradaSemPedido";
import { Chip, botaoClass, botaoPerigoStyle, botaoPrimarioStyle, botaoStyle, inputClass, inputStyle } from "./ui";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dBR = (s: string) => (s ? s.slice(8, 10) + "/" + s.slice(5, 7) + "/" + s.slice(0, 4) : "—");

function Pedido({ p, hoje }: { p: PedidoCompra; hoje: string }) {
  const { pending, run } = useAcaoOdoo();
  const [aberto, setAberto] = useState(false);
  const [qtd, setQtd] = useState<Record<string, number>>({});
  const [nf, setNf] = useState("");
  const [serie, setSerie] = useState("");
  const [chave, setChave] = useState("");
  const [novaData, setNovaData] = useState("");
  // 26/10: boletos (contas a pagar) -- vêm do XML pela chave, editáveis
  const [emissao, setEmissao] = useState("");
  const [parcelas, setParcelas] = useState<ParcelaPagar[]>([]);
  const [lancarPagar, setLancarPagar] = useState(true);
  const [infoNf, setInfoNf] = useState<NfChave | null>(null);
  function colarChave(v: string) {
    setChave(v);
    const c = v.replace(/\D/g, "");
    if (c.length !== 44) return;
    buscarNfChaveAction(c).then((r) => {
      if (!r.ok || !r.dados) return;
      const d = r.dados;
      setInfoNf(d);
      if (d.numero) setNf(d.numero);
      if (d.serie) setSerie(d.serie);
      if (d.emissao) setEmissao(d.emissao);
      if (d.parcelas?.length) setParcelas(d.parcelas.map((x) => ({ venc: x.venc, valor: x.valor, n: x.n })));
    });
  }
  const pendente = p.recebimentos.find((r) => r.estado !== "done" && r.estado !== "cancel");
  const abertos = p.itens.filter((i) => i.falta > 0);
  return (
    <div className="cartao p-4 flex flex-col gap-3">
      <button type="button" className="flex justify-between gap-2 flex-wrap text-left" onClick={() => setAberto((a) => !a)}>
        <span style={{ color: "var(--text-primary)" }}>
          <b>{p.numero}</b> · {p.fornecedor}
          {p.ref ? <span style={{ color: "var(--text-secondary)" }}> · ref. {p.ref}</span> : null}
        </span>
        <span className="flex gap-2 flex-wrap items-center text-sm">
          <Chip cor={p.vencida ? "var(--status-critical)" : undefined} forte={p.vencida}>
            {p.vencida ? "⚠ previsão vencida " : "chega "}
            {dBR(p.previsao)}
          </Chip>
          <Chip>{p.recebimento || p.estado}</Chip>
          <Chip>
            {abertos.length} de {p.itens.length} itens faltando · {brl(p.total)}
          </Chip>
          <span>{aberto ? "▲" : "▼"}</span>
        </span>
      </button>
      {aberto ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: "var(--text-secondary)" }}>
                  <th className="text-left py-1">Produto</th>
                  <th>Pedido</th>
                  <th>Já chegou</th>
                  <th>Falta</th>
                  <th>Previsão</th>
                  <th>Chegou agora</th>
                </tr>
              </thead>
              <tbody>
                {p.itens.map((i) => (
                  <tr key={i.linha_id} style={{ color: "var(--text-primary)" }}>
                    <td className="py-1">
                      <b>{i.codigo}</b> {i.nome.replace(/^\[[^\]]*\]\s*/, "").slice(0, 60)}
                    </td>
                    <td className="text-center">{i.qtd}</td>
                    <td className="text-center">{i.recebido}</td>
                    <td className="text-center">{i.falta}</td>
                    <td className="text-center" style={{ color: i.vencida ? "var(--status-critical)" : undefined }}>
                      {i.falta > 0 ? dBR(i.previsao) : "—"}
                    </td>
                    <td className="text-center">
                      {i.falta > 0 && pendente ? (
                        <input
                          type="number"
                          min={0}
                          max={i.falta}
                          step={1}
                          className={inputClass}
                          style={{ ...inputStyle, width: 80 }}
                          value={qtd[i.codigo] ?? ""}
                          placeholder="0"
                          onChange={(e) => setQtd((q) => ({ ...q, [i.codigo]: Number(e.target.value) }))}
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pendente ? (
            <div className="flex flex-col gap-2">
              <b className="text-sm" style={{ color: "var(--text-primary)" }}>
                Dar entrada da nota ({pendente.numero})
              </b>
              <div className="flex gap-2 flex-wrap">
                <input className={inputClass} style={{ ...inputStyle, maxWidth: 160 }} placeholder="Nº da nota" value={nf} onChange={(e) => setNf(e.target.value)} />
                <input className={inputClass} style={{ ...inputStyle, maxWidth: 90 }} placeholder="Série" value={serie} onChange={(e) => setSerie(e.target.value)} />
                <input className={inputClass} style={{ ...inputStyle, maxWidth: 420 }} placeholder="Chave de acesso (44 números) — preenche nota e boletos" value={chave} onChange={(e) => colarChave(e.target.value)} />
                <button
                  type="button"
                  className={botaoClass}
                  style={botaoStyle}
                  onClick={() => setQtd(Object.fromEntries(abertos.map((i) => [i.codigo, i.falta])))}
                >
                  Chegou tudo
                </button>
              </div>
              {infoNf ? (
                <p className="text-sm" style={{ color: infoNf.achou && infoNf.fornecedor && !p.fornecedor.toUpperCase().includes(infoNf.fornecedor.toUpperCase().split(" ")[0]) ? "var(--status-critical)" : "var(--text-secondary)" }}>
                  {infoNf.achou
                    ? `NF ${infoNf.numero}/${infoNf.serie} · ${infoNf.fornecedor} · emissão ${dBR(infoNf.emissao || "")} · total ${brl(infoNf.total || 0)} · ${infoNf.itens?.length ?? 0} item(ns)`
                    : infoNf.aviso}
                  {infoNf.achou && infoNf.fornecedor && !p.fornecedor.toUpperCase().includes(infoNf.fornecedor.toUpperCase().split(" ")[0]) ? " ⚠ fornecedor da nota diferente do pedido" : ""}
                </p>
              ) : null}
              <div className="flex flex-col gap-1" style={{ borderTop: "1px dashed var(--border)", paddingTop: 6 }}>
                <label className="text-sm flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                  <input type="checkbox" checked={lancarPagar} onChange={(e) => setLancarPagar(e.target.checked)} /> <b>Lançar contas a pagar (boletos)</b>
                  <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    {parcelas.length ? `${parcelas.length} boleto(s) · ${brl(parcelas.reduce((a, x) => a + (Number(x.valor) || 0), 0))}` : "sem boletos: vence na data de hoje"}
                  </span>
                </label>
                {lancarPagar ? (
                  <>
                    <div className="flex gap-2 items-center text-sm">
                      Emissão da nota <input type="date" className={inputClass} style={{ ...inputStyle, maxWidth: 170 }} value={emissao} onChange={(e) => setEmissao(e.target.value)} />
                    </div>
                    {parcelas.map((x, i) => (
                      <div key={i} className="flex gap-2 items-center text-sm">
                        <span style={{ width: 60 }}>Boleto {x.n || i + 1}</span>
                        <input type="date" className={inputClass} style={{ ...inputStyle, maxWidth: 170 }} value={x.venc}
                          onChange={(e) => setParcelas((ps) => ps.map((y, j) => (j === i ? { ...y, venc: e.target.value } : y)))} />
                        <input type="number" step="0.01" min={0} className={inputClass} style={{ ...inputStyle, maxWidth: 140 }} value={x.valor}
                          onChange={(e) => setParcelas((ps) => ps.map((y, j) => (j === i ? { ...y, valor: Number(e.target.value) } : y)))} />
                        <button type="button" className={botaoClass} style={botaoStyle} onClick={() => setParcelas((ps) => ps.filter((_, j) => j !== i))}>✕</button>
                      </div>
                    ))}
                    <button type="button" className={botaoClass} style={{ ...botaoStyle, alignSelf: "flex-start" }}
                      onClick={() => setParcelas((ps) => [...ps, { venc: "", valor: 0, n: String(ps.length + 1).padStart(3, "0") }])}>
                      ＋ boleto
                    </button>
                  </>
                ) : null}
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  className={botaoClass}
                  style={botaoPrimarioStyle}
                  disabled={pending}
                  onClick={() => {
                    const itens = Object.entries(qtd).map(([codigo, q]) => ({ codigo, qtd: Number(q) || 0 })).filter((i) => i.qtd > 0);
                    const total = itens.reduce((s, i) => s + i.qtd, 0);
                    if (!confirm(`Dar entrada da NF ${nf} no ${p.numero}: ${itens.length} produto(s), ${total} peça(s)? O estoque entra no CD.`)) return;
                    run(
                      () => entradaCompraAction(pendente.id, { nf, serie, chave, itens, lancar_pagar: lancarPagar, emissao, parcelas }),
                      (d) => `Entrada feita (${d.recebimento})${d.pendente?.length ? " · o resto continua previsto em " + d.pendente.join(", ") : " · pedido completo"}` +
                        (d.pagar ? ` · contas a pagar ${d.pagar.conta}: ${d.pagar.parcelas.map((x) => dBR(x.venc) + " " + brl(x.valor)).join(", ")}` : "") +
                        (d.aviso_pagar ? ` · ⚠ ${d.aviso_pagar}` : ""),
                    );
                  }}
                >
                  {pending ? "Dando entrada…" : "✅ Dar entrada"}
                </button>
              </div>
            </div>
          ) : null}
          {abertos.length ? (
            <div className="flex gap-2 flex-wrap items-center">
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Nova previsão de chegada (o que falta):
              </span>
              <input type="date" min={hoje} className={inputClass} style={{ ...inputStyle, maxWidth: 170 }} value={novaData} onChange={(e) => setNovaData(e.target.value)} />
              <button
                type="button"
                className={botaoClass}
                style={botaoStyle}
                disabled={pending || !novaData}
                onClick={() => run(() => previsaoCompraAction(p.id, novaData), `Previsão do ${p.numero} mudada para ${dBR(novaData)}.`)}
              >
                Mudar previsão
              </button>
              {p.itens.every((i) => !i.recebido) ? (
                <button
                  type="button"
                  className={botaoClass}
                  style={botaoPerigoStyle}
                  disabled={pending}
                  onClick={() => {
                    const m = prompt(`Motivo para cancelar o ${p.numero}:`, "");
                    if (m === null) return;
                    run(() => cancelarCompraAction(p.id, m), `${p.numero} cancelado.`);
                  }}
                >
                  Cancelar pedido
                </button>
              ) : null}
            </div>
          ) : null}
          {p.obs ? (
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              obs: {p.obs.replace(/<[^>]+>/g, " ")}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

type Linha = { codigo: string; qtd: string; preco: string; previsao: string };

function NovoPedido({ hoje }: { hoje: string }) {
  const { pending, run } = useAcaoOdoo();
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [achados, setAchados] = useState<FornecedorOdoo[]>([]);
  const [erroBusca, setErroBusca] = useState("");
  const [forn, setForn] = useState<FornecedorOdoo | null>(null);
  const [ref, setRef] = useState("");
  const [obs, setObs] = useState("");
  const vazia = (): Linha => ({ codigo: "", qtd: "", preco: "", previsao: "" });
  const [linhas, setLinhas] = useState<Linha[]>([vazia()]);
  const muda = (n: number, k: keyof Linha, v: string) => setLinhas((ls) => ls.map((l, i) => (i === n ? { ...l, [k]: v } : l)));
  if (!aberto) {
    return (
      <button type="button" className={botaoClass} style={botaoPrimarioStyle} onClick={() => setAberto(true)}>
        ＋ Novo pedido de compra
      </button>
    );
  }
  return (
    <div className="cartao p-4 flex flex-col gap-3">
      <b style={{ color: "var(--text-primary)" }}>Novo pedido de compra (CD)</b>
      {forn ? (
        <div className="flex gap-2 items-center flex-wrap text-sm" style={{ color: "var(--text-primary)" }}>
          Fornecedor: <b>{forn.nome}</b> {forn.cnpj}
          <button type="button" className={botaoClass} style={botaoStyle} onClick={() => setForn(null)}>
            trocar
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2 flex-wrap">
            <input className={inputClass} style={{ ...inputStyle, maxWidth: 360 }} placeholder="Fornecedor: nome ou CNPJ" value={busca} onChange={(e) => setBusca(e.target.value)} />
            <button
              type="button"
              className={botaoClass}
              style={botaoStyle}
              onClick={async () => {
                setErroBusca("");
                const r = await buscarFornecedoresAction(busca);
                if (r.ok) setAchados(r.dados);
                else setErroBusca(r.erro);
              }}
            >
              Buscar
            </button>
          </div>
          {erroBusca ? <span className="text-sm" style={{ color: "var(--status-critical)" }}>{erroBusca}</span> : null}
          {achados.map((f) => (
            <button key={f.id} type="button" className="text-left text-sm underline" style={{ color: "var(--text-primary)" }} onClick={() => setForn(f)}>
              {f.nome} · {f.cnpj} · {f.cidade}
              {f.ja_fornece ? " · já fornece" : ""}
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-2 flex-wrap">
        <input className={inputClass} style={{ ...inputStyle, maxWidth: 220 }} placeholder="Nº do pedido no fornecedor (opcional)" value={ref} onChange={(e) => setRef(e.target.value)} />
        <input className={inputClass} style={inputStyle} placeholder="Observação (opcional)" value={obs} onChange={(e) => setObs(e.target.value)} />
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ color: "var(--text-secondary)" }}>
            <th className="text-left">Código</th>
            <th>Qtd</th>
            <th>Preço de compra (un.)</th>
            <th>Previsão de chegada</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, n) => (
            <tr key={n}>
              <td><input className={inputClass} style={inputStyle} value={l.codigo} placeholder="070194" onChange={(e) => muda(n, "codigo", e.target.value)} /></td>
              <td><input type="number" min={1} className={inputClass} style={inputStyle} value={l.qtd} onChange={(e) => muda(n, "qtd", e.target.value)} /></td>
              <td><input type="number" min={0} step="0.01" className={inputClass} style={inputStyle} value={l.preco} onChange={(e) => muda(n, "preco", e.target.value)} /></td>
              <td><input type="date" min={hoje} className={inputClass} style={inputStyle} value={l.previsao} onChange={(e) => muda(n, "previsao", e.target.value)} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-2 flex-wrap">
        <button type="button" className={botaoClass} style={botaoStyle} onClick={() => setLinhas((ls) => [...ls, { ...vazia(), previsao: ls[ls.length - 1]?.previsao ?? "" }])}>
          ＋ produto
        </button>
        <button
          type="button"
          className={botaoClass}
          style={botaoPrimarioStyle}
          disabled={pending || !forn}
          onClick={() =>
            run(
              () =>
                criarCompraAction({
                  fornecedor_id: forn?.id ?? 0,
                  ref,
                  obs,
                  itens: linhas.map((l) => ({ codigo: l.codigo.trim(), qtd: Number(l.qtd), preco: Number(String(l.preco).replace(",", ".")), previsao: l.previsao })),
                }),
              (d) => {
                setAberto(false);
                setLinhas([vazia()]);
                setForn(null);
                return `Pedido ${d.pedido?.numero ?? ""} criado. A previsão já aparece no coach em até 10 min.`;
              },
            )
          }
        >
          {pending ? "Criando…" : "✅ Criar pedido de compra"}
        </button>
        <button type="button" className={botaoClass} style={botaoStyle} onClick={() => setAberto(false)}>
          Fechar
        </button>
      </div>
    </div>
  );
}

export function ComprasBoard({ pedidos, hoje, estado, q }: { pedidos: PedidoCompra[]; hoje: string; estado: string; q: string }) {
  const vencidos = pedidos.filter((p) => p.vencida).length;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 flex-wrap items-center">
        <NovoPedido hoje={hoje} />
        <EntradaSemPedido />
        <form className="flex gap-2 flex-wrap" action="/assistencia/logistica/compras">
          <input name="q" defaultValue={q} className={inputClass} style={{ ...inputStyle, maxWidth: 260 }} placeholder="Buscar: P00070, fornecedor, código" />
          <select name="estado" defaultValue={estado} className={inputClass} style={{ ...inputStyle, maxWidth: 170 }}>
            <option value="abertos">Faltando chegar</option>
            <option value="todos">Todos</option>
          </select>
          <button className={botaoClass} style={botaoStyle}>Filtrar</button>
        </form>
        {q || estado !== "abertos" ? (
          <Link href="/assistencia/logistica/compras" className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
            limpar
          </Link>
        ) : null}
      </div>
      <p className="text-sm" style={{ color: vencidos ? "var(--status-critical)" : "var(--text-secondary)" }}>
        {pedidos.length} pedido(s){vencidos ? ` · ${vencidos} com previsão vencida — mude a data ou dê entrada, senão o vendedor vê previsão errada` : ""}
      </p>
      {pedidos.map((p) => (
        <Pedido key={p.id} p={p} hoje={hoje} />
      ))}
    </div>
  );
}
