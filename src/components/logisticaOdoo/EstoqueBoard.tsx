"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { EmpresaOdoo } from "@/lib/odoo/logisticaTipos";
import type { AudFiltro, AudLista, AudPedidoItem, AudPosicaoItem, AudReservaItem, AudSefazItem } from "@/lib/odoo/logistica";
import { audPedidosAction, audPosicaoAction, audReservasAction, audSefazAction } from "@/app/assistencia/logistica/logistica-actions";
import { Kpi, botaoClass, botaoPrimarioStyle, botaoStyle, inputClass, inputStyle } from "./ui";

// 26/10 (Pedro via Antônio Costa — rotinas do Flávio, auditoria do CD). Sub-abas: Posição, Negativo, Reservas, Pedidos parados, SEFAZ.
type Vis = "posicao" | "negativo" | "reservas" | "pedidos" | "sefaz";
const VISOES: { id: Vis; rotulo: string }[] = [
  { id: "posicao", rotulo: "Posição de estoque" },
  { id: "negativo", rotulo: "Saldo negativo" },
  { id: "reservas", rotulo: "Controle de reservas" },
  { id: "pedidos", rotulo: "Pedidos sem nota / sem entrega" },
  { id: "sefaz", rotulo: "SEFAZ (notas contra os CNPJs)" },
];
const PAGINA = 200;
type Item = AudPosicaoItem | AudReservaItem | AudSefazItem | AudPedidoItem;

const num = (v: number) => Number(v || 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const brl = (v: number) => "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function dia(s: string) {
  if (!s || s.length < 10) return s || "";
  const t = Date.parse(s.slice(0, 19).replace(" ", "T") + "Z");
  if (Number.isNaN(t)) return s.slice(8, 10) + "/" + s.slice(5, 7) + "/" + s.slice(0, 4);
  const d = new Date(t - 3 * 36e5);
  const z = (n: number) => String(n).padStart(2, "0");
  return `${z(d.getUTCDate())}/${z(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

function csv(linhas: Record<string, unknown>[], nome: string) {
  if (!linhas.length) return;
  const cols = Object.keys(linhas[0]);
  const esc = (v: unknown) => {
    const s = Array.isArray(v) ? v.join(" ") : String(v ?? "");
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const corpo = [cols.join(";"), ...linhas.map((l) => cols.map((c) => esc(typeof l[c] === "number" ? String(l[c]).replace(".", ",") : l[c])).join(";"))].join("\n");
  const url = URL.createObjectURL(new Blob(["﻿" + corpo], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

export function EstoqueBoard({ empresas, categorias }: { empresas: EmpresaOdoo[]; categorias: { id: number; nome: string }[] }) {
  const cd = empresas.find((e) => e.name.startsWith("213 "));
  const [vis, setVis] = useState<Vis>("posicao");
  const [empresa, setEmpresa] = useState<number>(cd?.id ?? 0);
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [categoria, setCategoria] = useState(0);
  const [dias, setDias] = useState(60);
  const [situacao, setSituacao] = useState("todas");
  const [tipoPed, setTipoPed] = useState("");
  const [dados, setDados] = useState<AudLista<Item> | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const filtro = useCallback(
    (offset = 0, formato?: "csv"): AudFiltro => ({
      company_id: empresa, q: buscaAplicada || undefined, categoria: categoria || undefined, negativo: vis === "negativo",
      dias: vis === "sefaz" ? dias : undefined, situacao: vis === "sefaz" ? situacao : undefined, limit: PAGINA, offset, formato,
    }),
    [empresa, buscaAplicada, categoria, vis, dias, situacao],
  );

  const chamar = useCallback(
    (f: AudFiltro) =>
      (vis === "reservas" ? audReservasAction(f) : vis === "sefaz" ? audSefazAction(f) : vis === "pedidos" ? audPedidosAction(f) : audPosicaoAction(f)) as Promise<
        { ok: true; dados: AudLista<Item> } | { ok: false; erro: string }
      >,
    [vis],
  );

  const carregar = useCallback(
    async (mais = false) => {
      setCarregando(true);
      setErro(null);
      const r = await chamar(filtro(mais && dados ? dados.itens.length : 0));
      setCarregando(false);
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setDados((d) => (mais && d ? { ...r.dados, itens: [...d.itens, ...r.dados.itens] } : r.dados));
    },
    [chamar, filtro, dados],
  );

  // recarrega quando muda a visão ou um filtro aplicado (a busca só vale ao apertar Buscar/Enter)
  useEffect(() => {
    const t = setTimeout(() => void carregar(false), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vis, empresa, buscaAplicada, categoria, dias, situacao]);

  async function baixarCsv() {
    setCarregando(true);
    const r = await chamar(filtro(0, "csv"));
    setCarregando(false);
    if (!r.ok) {
      setErro(r.erro);
      return;
    }
    const nomeEmp = empresa ? (empresas.find((e) => e.id === empresa)?.name.split(" ")[0] ?? empresa) : "todas";
    csv(r.dados.itens as unknown as Record<string, unknown>[], `${vis}_${nomeEmp}_${new Date().toISOString().slice(0, 10)}.csv`);
  }

  const T = dados?.totais ?? {};
  const itens = (dados?.itens ?? []).filter((i) => vis !== "pedidos" || !tipoPed || (i as AudPedidoItem).tipo === tipoPed);
  const temMais = !!dados && vis !== "pedidos" && dados.total > dados.itens.length;

  return (
    <div className="flex flex-col gap-3 min-w-0">
      <div className="flex gap-2 flex-wrap">
        {VISOES.map((v) => (
          <button key={v.id} type="button" className={botaoClass} style={v.id === vis ? botaoPrimarioStyle : botaoStyle} onClick={() => setVis(v.id)}>
            {v.rotulo}
          </button>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap items-end">
        <label className="flex flex-col text-sm" style={{ color: "var(--text-secondary)" }}>
          Loja / CD
          <select value={String(empresa)} onChange={(e) => setEmpresa(Number(e.target.value))} className={inputClass} style={{ ...inputStyle, minWidth: 220 }}>
            <option value="0">Todas as lojas e o CD</option>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        {vis !== "pedidos" ? (
          <form
            className="flex gap-2 items-end"
            onSubmit={(e) => {
              e.preventDefault();
              setBuscaAplicada(busca.trim());
            }}
          >
            <label className="flex flex-col text-sm" style={{ color: "var(--text-secondary)" }}>
              {vis === "sefaz" ? "Fornecedor, CNPJ, número ou chave" : vis === "reservas" ? "Produto, cliente ou pedido" : "Código, nome ou código de barras"}
              <input className={inputClass} style={{ ...inputStyle, minWidth: 260 }} value={busca} onChange={(e) => setBusca(e.target.value)} />
            </label>
            <button type="submit" className={botaoClass} style={botaoStyle}>
              Buscar
            </button>
          </form>
        ) : (
          <label className="flex flex-col text-sm" style={{ color: "var(--text-secondary)" }}>
            Mostrar
            <select value={tipoPed} onChange={(e) => setTipoPed(e.target.value)} className={inputClass} style={inputStyle}>
              <option value="">Todos</option>
              <option value="sem_nota">Sem nota</option>
              <option value="sem_entrega">Pago, sem entrega</option>
              <option value="alerta">Saiu sem nota de entrega</option>
              <option value="aguarda_cd">Aguardando o CD (abastecimento)</option>
            </select>
          </label>
        )}
        {vis === "posicao" || vis === "negativo" ? (
          <label className="flex flex-col text-sm" style={{ color: "var(--text-secondary)" }}>
            Categoria
            <select value={String(categoria)} onChange={(e) => setCategoria(Number(e.target.value))} className={inputClass} style={{ ...inputStyle, maxWidth: 280 }}>
              <option value="0">Todas</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {vis === "sefaz" ? (
          <>
            <label className="flex flex-col text-sm" style={{ color: "var(--text-secondary)" }}>
              Período
              <select value={String(dias)} onChange={(e) => setDias(Number(e.target.value))} className={inputClass} style={inputStyle}>
                {[7, 30, 60, 90, 180].map((d) => (
                  <option key={d} value={d}>
                    últimos {d} dias
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-sm" style={{ color: "var(--text-secondary)" }}>
              Situação
              <select value={situacao} onChange={(e) => setSituacao(e.target.value)} className={inputClass} style={inputStyle}>
                <option value="todas">Todas</option>
                <option value="sem_entrada">Sem entrada</option>
              </select>
            </label>
          </>
        ) : null}
        <button type="button" className={botaoClass} style={botaoStyle} onClick={() => void carregar(false)} disabled={carregando}>
          ↻ Atualizar
        </button>
        <button type="button" className={botaoClass} style={botaoStyle} onClick={() => void baixarCsv()} disabled={carregando || !dados?.total}>
          Baixar planilha (CSV)
        </button>
      </div>

      {dados ? (
        <div className="grid gap-2 grid-cols-2 md:grid-cols-4 xl:grid-cols-6">
          {vis === "posicao" || vis === "negativo" ? (
            <>
              <Kpi rotulo="Produtos" valor={num(T.produtos)} />
              <Kpi rotulo="Físico" valor={num(T.fisico)} />
              <Kpi rotulo="Reservado" valor={num(T.reservado)} />
              <Kpi rotulo="Disponível" valor={num(T.disponivel)} />
              <Kpi rotulo="Valor (custo médio)" valor={brl(T.valor)} />
              <Kpi rotulo="Negativos" valor={<span style={{ color: T.negativos ? "var(--status-critical)" : undefined }}>{num(T.negativos)}</span>} />
            </>
          ) : vis === "reservas" ? (
            <>
              <Kpi rotulo="Peças reservadas" valor={num(T.qtd)} />
              <Kpi rotulo="Linhas" valor={num(T.linhas)} />
              <Kpi rotulo="Produtos" valor={num(T.produtos)} />
              <Kpi rotulo="Há mais de 30 dias" valor={<span style={{ color: T.velhas ? "var(--status-critical)" : undefined }}>{num(T.velhas)}</span>} />
            </>
          ) : vis === "pedidos" ? (
            <>
              <Kpi rotulo="Pedidos parados" valor={num(T.pedidos)} detalhe={brl(T.valor)} />
              <Kpi rotulo="Sem nota" valor={num(T.sem_nota)} />
              <Kpi rotulo="Pago, sem entrega" valor={num(T.sem_entrega)} />
              <Kpi rotulo="Saiu sem nota de entrega" valor={<span style={{ color: T.alerta ? "var(--status-critical)" : undefined }}>{num(T.alerta)}</span>} />
              <Kpi rotulo="Aguardando o CD" valor={num(T.aguarda_cd)} />
              <Kpi rotulo="Parados > 7 dias" valor={num(T.parados_7d)} />
            </>
          ) : (
            <>
              <Kpi rotulo="Notas" valor={num(T.notas)} detalhe={brl(T.valor)} />
              <Kpi rotulo="Sem entrada" valor={<span style={{ color: T.sem_entrada ? "var(--status-serious)" : undefined }}>{num(T.sem_entrada)}</span>} />
              <Kpi rotulo="XML ainda não baixado" valor={num(T.sem_xml)} />
            </>
          )}
        </div>
      ) : null}

      {erro ? (
        <p className="text-sm" style={{ color: "var(--status-critical)" }}>
          {erro}
        </p>
      ) : null}
      {carregando && !dados ? <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Carregando…</p> : null}

      {dados ? (
        <div className="cartao p-3 overflow-x-auto">
          <table className="w-full text-sm" style={{ color: "var(--text-primary)" }}>
            <Cabecalho vis={vis} todas={!empresa} />
            <tbody>
              {itens.map((i, n) => (
                <Linha key={n} vis={vis} item={i} todas={!empresa} />
              ))}
            </tbody>
          </table>
          {!itens.length ? <p className="text-sm py-3" style={{ color: "var(--text-secondary)" }}>{vis === "negativo" ? "Nenhum produto negativo." : "Nada encontrado."}</p> : null}
          {temMais ? (
            <div className="text-center mt-3">
              <button type="button" className={botaoClass} style={botaoStyle} disabled={carregando} onClick={() => void carregar(true)}>
                {carregando ? "Carregando…" : `Carregar mais (${(dados.total - dados.itens.length).toLocaleString("pt-BR")} restantes)`}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const th = "text-left py-2 pr-3 font-semibold";
const thR = "text-right py-2 pr-3 font-semibold";

function Cabecalho({ vis, todas }: { vis: Vis; todas: boolean }) {
  const c = { color: "var(--text-secondary)" };
  if (vis === "posicao" || vis === "negativo")
    return (
      <thead>
        <tr style={c}>
          <th className={th}>Produto</th>
          {todas || vis === "negativo" ? <th className={th}>Loja</th> : null}
          <th className={thR}>Físico</th>
          <th className={thR}>Reservado</th>
          <th className={thR}>Disponível</th>
          <th className={thR}>Custo médio</th>
          <th className={thR}>Valor</th>
        </tr>
      </thead>
    );
  if (vis === "reservas")
    return (
      <thead>
        <tr style={c}>
          <th className={th}>Produto</th>
          <th className={thR}>Qtd</th>
          {todas ? <th className={th}>Loja</th> : null}
          <th className={th}>Para</th>
          <th className={th}>Documento</th>
          <th className={thR}>Desde</th>
        </tr>
      </thead>
    );
  if (vis === "pedidos")
    return (
      <thead>
        <tr style={c}>
          <th className={thR}>Dias</th>
          <th className={th}>Pedido / cliente</th>
          <th className={th}>Loja</th>
          <th className={th}>Vendedor</th>
          <th className={th}>Situação</th>
          <th className={thR}>Valor</th>
          <th className={thR}>Reservado</th>
        </tr>
      </thead>
    );
  return (
    <thead>
      <tr style={c}>
        <th className={th}>Emissão</th>
        <th className={th}>Nota</th>
        <th className={th}>Emitente</th>
        {todas ? <th className={th}>Loja</th> : null}
        <th className={thR}>Valor</th>
        <th className={th}>Manifestação</th>
        <th className={th}>XML</th>
        <th className={th}>Entrada</th>
      </tr>
    </thead>
  );
}

function Linha({ vis, item, todas }: { vis: Vis; item: Item; todas: boolean }) {
  const borda = { borderTop: "1px solid var(--border)" };
  const td = "py-2 pr-3 align-top";
  const tdR = "py-2 pr-3 align-top text-right";
  const muted = { color: "var(--text-secondary)" };
  const ruim = { color: "var(--status-critical)", fontWeight: 700 };
  if (vis === "posicao" || vis === "negativo") {
    const i = item as AudPosicaoItem;
    return (
      <tr style={borda}>
        <td className={td}>
          <b>{i.codigo}</b> {i.produto}
          {i.categoria ? <div className="text-xs" style={muted}>{i.categoria}</div> : null}
        </td>
        {todas || vis === "negativo" ? <td className={td}>{i.loja}</td> : null}
        <td className={tdR} style={i.fisico < 0 ? ruim : undefined}>{num(i.fisico)}</td>
        <td className={tdR}>{num(i.reservado)}</td>
        <td className={tdR}><b>{num(i.disponivel)}</b></td>
        <td className={tdR}>{brl(i.custo_medio)}</td>
        <td className={tdR}>{brl(i.valor)}</td>
      </tr>
    );
  }
  if (vis === "reservas") {
    const i = item as AudReservaItem;
    return (
      <tr style={borda}>
        <td className={td}>
          <b>{i.codigo}</b> {i.produto}
        </td>
        <td className={tdR}>{num(i.qtd)}</td>
        {todas ? <td className={td}>{i.loja}</td> : null}
        <td className={td}>
          {i.cliente || "—"}
          {i.pedido ? <div className="text-xs" style={muted}>pedido {i.pedido}</div> : null}
        </td>
        <td className={td}>
          <div className="text-xs">{i.tipo}</div>
          <div className="text-xs" style={muted}>{i.documento}</div>
        </td>
        <td className={tdR} style={i.dias > 30 ? ruim : undefined}>
          {dia(i.desde)}
          <div className="text-xs" style={muted}>{i.dias} dias</div>
        </td>
      </tr>
    );
  }
  if (vis === "pedidos") {
    const i = item as AudPedidoItem;
    return (
      <tr style={borda}>
        <td className={tdR} style={i.dias > 7 ? ruim : undefined}>
          {i.dias}
          <div className="text-xs" style={muted}>{dia(i.data)}</div>
        </td>
        <td className={td}>
          <b>{i.pedido}</b> · {i.cliente}
          {i.nf5922 ? <div className="text-xs" style={muted}>nota 5922 {i.nf5922}</div> : null}
        </td>
        <td className={td}>
          {i.loja}
          {i.retira_em && i.retira_em !== i.loja ? <div className="text-xs" style={muted}>retira na {i.retira_em}</div> : null}
        </td>
        <td className={td}><span className="text-xs">{i.vendedor || "—"}</span></td>
        <td className={td} style={i.tipo === "alerta" ? ruim : i.tipo === "sem_nota" ? { color: "var(--status-serious)" } : undefined}>
          {i.situacao}
          <div className="text-xs" style={muted}>
            {i.pago ? "pago" : i.pagto_vendedor ? `vendedor informou ${i.pagto_vendedor} (não confirmado no caixa)` : "sem pagamento registrado"}
          </div>
        </td>
        <td className={tdR}>{brl(i.valor)}</td>
        <td className={tdR}>{i.reservado ? num(i.reservado) : "—"}</td>
      </tr>
    );
  }
  const i = item as AudSefazItem;
  return (
    <tr style={borda}>
      <td className={td}>{dia(i.emissao)}</td>
      <td className={td}>
        {i.numero}
        {i.serie ? `/${i.serie}` : ""}
        <div className="text-xs" style={muted} title={i.chave}>
          {i.chave ? `${i.chave.slice(0, 6)}…${i.chave.slice(-6)}` : ""}
        </div>
      </td>
      <td className={td}>
        {i.emitente || "—"}
        <div className="text-xs" style={muted}>{i.cnpj}</div>
      </td>
      {todas ? <td className={td}>{i.loja}</td> : null}
      <td className={tdR}>{brl(i.valor)}</td>
      <td className={td}>{i.manifestacao}</td>
      <td className={td}>{i.xml ? "baixado" : <span style={{ color: "var(--status-serious)" }}>ainda não</span>}</td>
      <td className={td}>
        {i.entrada ? (
          "feita"
        ) : i.transferencia ? (
          <span style={{ color: "var(--status-serious)" }}>pendente na loja (Entrada de nota do caixa)</span>
        ) : (
          <Link href="/assistencia/logistica/compras" className="underline" style={{ color: "var(--status-serious)" }}>
            pendente · dar entrada
          </Link>
        )}
      </td>
    </tr>
  );
}
