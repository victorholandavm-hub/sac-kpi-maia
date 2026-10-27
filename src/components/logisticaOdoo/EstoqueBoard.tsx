"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { EmpresaOdoo } from "@/lib/odoo/logisticaTipos";
import type {
  AudFaixa, AudFiltro2, AudGeralItem, AudGrupoLinha, AudLista, AudPedidoItem, AudPosicaoItem, AudReservaItem, AudRotItem, AudSefazItem,
} from "@/lib/odoo/logistica";
import {
  audAgrupadoAction, audGeralAction, audPedidosAction, audPosicaoAction, audReservasAction, audRotatividadeAction, audSefazAction,
} from "@/app/assistencia/logistica/logistica-actions";
import { Kpi, botaoClass, botaoPrimarioStyle, botaoStyle, inputClass, inputStyle } from "./ui";

// 26/10 (Pedro via Antônio Costa — rotinas do Flávio, auditoria do CD). Relatórios que ele monitora de cada filial e do CD.
type Vis = "posicao" | "geral" | "fornecedor" | "grupo" | "negativo" | "parado" | "giro" | "reservas" | "pedidos" | "sefaz";
const VISOES: { id: Vis; rotulo: string }[] = [
  { id: "posicao", rotulo: "Posição de estoque" },
  { id: "geral", rotulo: "Geral (com e sem saldo)" },
  { id: "fornecedor", rotulo: "Por fornecedor" },
  { id: "grupo", rotulo: "Por grupo" },
  { id: "negativo", rotulo: "Saldo negativo" },
  { id: "parado", rotulo: "Dias sem rotatividade" },
  { id: "giro", rotulo: "Dias com rotatividade" },
  { id: "reservas", rotulo: "Controle de reservas" },
  { id: "pedidos", rotulo: "Pedidos sem nota / sem entrega" },
  { id: "sefaz", rotulo: "SEFAZ (notas contra os CNPJs)" },
];
const PAGINA = 200;
type Item = AudPosicaoItem | AudReservaItem | AudSefazItem | AudPedidoItem | AudGeralItem | AudGrupoLinha | AudRotItem;
type Extra = { calculado_em?: string; protheus_em?: string; faixas?: AudFaixa[] };
const COM_GRUPO: Vis[] = ["posicao", "negativo", "geral", "parado", "giro"];
const CONTAGEM: Vis[] = ["posicao", "negativo", "geral", "fornecedor", "grupo", "parado", "giro"];
const COM_SALDO: Vis[] = ["geral", "fornecedor", "grupo"];

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

function dataHora(s?: string) {
  if (!s) return "—";
  const t = Date.parse(s.slice(0, 19).replace(" ", "T") + "Z");
  if (Number.isNaN(t)) return s;
  const d = new Date(t - 3 * 36e5);
  const z = (n: number) => String(n).padStart(2, "0");
  return `${z(d.getUTCDate())}/${z(d.getUTCMonth() + 1)} ${z(d.getUTCHours())}:${z(d.getUTCMinutes())}`;
}
const LIM_FAIXA: Record<string, number> = { "até 29 dias": 0, "30 a 59": 30, "60 a 89": 60, "90 a 179": 90, "180 dias ou mais": 180, "sem registro de saída": 180 };

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

export function EstoqueBoard({ empresas, grupos }: { empresas: EmpresaOdoo[]; grupos: string[] }) {
  const cd = empresas.find((e) => e.name.startsWith("213 "));
  const [vis, setVis] = useState<Vis>("posicao");
  const [empresa, setEmpresa] = useState<number>(cd?.id ?? (empresas.length === 1 ? empresas[0].id : 0));
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [grupoNome, setGrupoNome] = useState("");
  const [saldo, setSaldo] = useState<"com" | "sem" | "todos">("com");
  const [diasMin, setDiasMin] = useState(0);
  const [extra, setExtra] = useState<Extra>({});
  const [aberto, setAberto] = useState<string | null>(null);
  const [itensGrupo, setItensGrupo] = useState<AudGeralItem[]>([]);
  const [dias, setDias] = useState(60);
  const [situacao, setSituacao] = useState("todas");
  const [tipoPed, setTipoPed] = useState("");
  const [dados, setDados] = useState<AudLista<Item> | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const filtro = useCallback(
    (offset = 0, formato?: "csv"): AudFiltro2 => ({
      company_id: empresa, q: buscaAplicada || undefined, grupo_nome: COM_GRUPO.includes(vis) && grupoNome ? grupoNome : undefined, negativo: vis === "negativo",
      dias: vis === "sefaz" ? dias : undefined, situacao: vis === "sefaz" ? situacao : undefined, limit: PAGINA, offset, formato,
      saldo: COM_SALDO.includes(vis) ? saldo : undefined, por: vis === "fornecedor" || vis === "grupo" ? vis : undefined,
      modo: vis === "parado" ? "sem" : vis === "giro" ? "com" : undefined, dias_min: vis === "parado" ? diasMin : undefined,
    }),
    [empresa, buscaAplicada, grupoNome, vis, dias, situacao, saldo, diasMin],
  );

  const chamar = useCallback(
    (f: AudFiltro2) =>
      (vis === "reservas" ? audReservasAction(f) : vis === "sefaz" ? audSefazAction(f) : vis === "pedidos" ? audPedidosAction(f)
        : vis === "geral" ? audGeralAction(f) : vis === "fornecedor" || vis === "grupo" ? audAgrupadoAction(f)
        : vis === "parado" || vis === "giro" ? audRotatividadeAction(f) : audPosicaoAction(f)) as Promise<
        { ok: true; dados: AudLista<Item> & Extra } | { ok: false; erro: string }
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
      setExtra({ calculado_em: r.dados.calculado_em, protheus_em: r.dados.protheus_em, faixas: r.dados.faixas });
      setDados((d) => (mais && d ? { ...r.dados, itens: [...d.itens, ...r.dados.itens] } : r.dados));
    },
    [chamar, filtro, dados],
  );

  // recarrega quando muda a visão ou um filtro aplicado (a busca só vale ao apertar Buscar/Enter)
  useEffect(() => {
    const t = setTimeout(() => {
      setAberto(null);
      void carregar(false);
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vis, empresa, buscaAplicada, grupoNome, dias, situacao, saldo, diasMin]);

  async function abrirGrupo(chave: string) {
    if (aberto === chave) {
      setAberto(null);
      return;
    }
    setAberto(chave);
    setItensGrupo([]);
    const r = await audAgrupadoAction({ ...filtro(0), grupo: chave });
    if (r.ok) setItensGrupo(r.dados.itens as AudGeralItem[]);
    else setErro(r.erro);
  }

  async function baixarCsv() {
    setCarregando(true);
    const r = await chamar(filtro(0, "csv"));
    setCarregando(false);
    if (!r.ok) {
      setErro(r.erro);
      return;
    }
    const nomeEmp = empresa ? (empresas.find((e) => e.id === empresa)?.name.split(" ")[0] ?? empresa) : "todas";
    const linhas = r.dados.itens as unknown as Record<string, unknown>[];
    // 27/10 (Pedro): relatório de CONTAGEM na sequência Filial · Código · Descrição · Fabricante · Quant. Sistema · Quant. Físico (em branco, p/ contar) · Armazém
    // Armazém igual ao antigo: 01 = estoque da loja, 75 = avaria, AT = assistência (linha própria quando tem saldo lá)
    if (CONTAGEM.includes(vis)) {
      const fil = (l: Record<string, unknown>) => String(l.loja || nomeEmp || "").split(" ")[0];
      const out: Record<string, unknown>[] = [];
      for (const l of linhas) {
        const base = { Filial: fil(l), "Codigo do produto": l.codigo ?? "", "Descrição": l.produto ?? "", Fabricante: l.fornecedor ?? "" };
        out.push({ ...base, "Quant. Sistema": Number(l.fisico ?? 0), "Quant. Físico": "", "Armazém": "01" });
        if (Number(l.avaria ?? 0)) out.push({ ...base, "Quant. Sistema": Number(l.avaria), "Quant. Físico": "", "Armazém": "75" });
        if (Number(l.assistencia ?? 0)) out.push({ ...base, "Quant. Sistema": Number(l.assistencia), "Quant. Físico": "", "Armazém": "AT" });
      }
      csv(out, `contagem_${vis}_${nomeEmp}_${new Date().toISOString().slice(0, 10)}.csv`);
      return;
    }
    csv(linhas, `${vis}_${nomeEmp}_${new Date().toISOString().slice(0, 10)}.csv`);
  }

  const T = dados?.totais ?? {};
  const itens = (dados?.itens ?? []).filter((i) => vis !== "pedidos" || !tipoPed || (i as AudPedidoItem).tipo === tipoPed);
  const temMais = !!dados && !["pedidos", "fornecedor", "grupo"].includes(vis) && dados.total > dados.itens.length;

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
        {COM_GRUPO.includes(vis) ? (
          <label className="flex flex-col text-sm" style={{ color: "var(--text-secondary)" }}>
            Grupo
            <select value={grupoNome} onChange={(e) => setGrupoNome(e.target.value)} className={inputClass} style={{ ...inputStyle, maxWidth: 280 }}>
              <option value="">Todos</option>
              {grupos.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {COM_SALDO.includes(vis) ? (
          <label className="flex flex-col text-sm" style={{ color: "var(--text-secondary)" }}>
            Saldo
            <select value={saldo} onChange={(e) => setSaldo(e.target.value as "com" | "sem" | "todos")} className={inputClass} style={inputStyle}>
              <option value="com">Com saldo</option>
              <option value="sem">Sem saldo</option>
              <option value="todos">Todos</option>
            </select>
          </label>
        ) : null}
        {vis === "parado" ? (
          <label className="flex flex-col text-sm" style={{ color: "var(--text-secondary)" }}>
            Sem saída há
            <select value={String(diasMin)} onChange={(e) => setDiasMin(Number(e.target.value))} className={inputClass} style={inputStyle}>
              {[0, 30, 60, 90, 180].map((d) => (
                <option key={d} value={d}>
                  {d ? `${d} dias ou mais` : "qualquer tempo"}
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
          {vis === "geral" ? (
            <>
              <Kpi rotulo="Produtos" valor={num(T.produtos)} />
              <Kpi rotulo="Com saldo" valor={num(T.com_saldo)} />
              <Kpi rotulo="Sem saldo" valor={num(T.sem_saldo)} />
              <Kpi rotulo="Quantidade" valor={num(T.fisico)} />
              <Kpi rotulo="Valor (custo médio)" valor={brl(T.valor)} />
            </>
          ) : vis === "fornecedor" || vis === "grupo" ? (
            <>
              <Kpi rotulo={vis === "fornecedor" ? "Fornecedores" : "Grupos"} valor={num(T.grupos)} />
              <Kpi rotulo="Produtos" valor={num(T.produtos)} />
              <Kpi rotulo="Quantidade" valor={num(T.qtd)} />
              <Kpi rotulo="Valor (custo médio)" valor={brl(T.valor)} />
            </>
          ) : vis === "parado" || vis === "giro" ? (
            <>
              <Kpi rotulo="Produtos" valor={num(T.produtos)} />
              <Kpi rotulo="Quantidade" valor={num(T.qtd)} />
              <Kpi rotulo={vis === "parado" ? "Valor parado (custo)" : "Valor em estoque"} valor={brl(T.valor)} />
              <Kpi rotulo="Calculado em" valor={<span className="text-sm">{dataHora(extra.calculado_em)}</span>} detalhe="histórico antigo até 24/10 + sistema novo" />
            </>
          ) : vis === "posicao" || vis === "negativo" ? (
            <>
              <Kpi rotulo="Produtos" valor={num(T.produtos)} />
              <Kpi rotulo="Físico" valor={num(T.fisico)} />
              <Kpi rotulo="Reservado" valor={num(T.reservado)} />
              <Kpi rotulo="Disponível" valor={num(T.disponivel)} />
              <Kpi rotulo="Valor (custo médio)" valor={brl(T.valor)} />
              <Kpi rotulo="Negativos" valor={<span style={{ color: T.negativos ? "var(--status-critical)" : undefined }}>{num(T.negativos)}</span>} />
              {vis === "posicao" ? <Kpi rotulo="Avaria / Assistência" valor={`${num(T.avaria)} / ${num(T.assistencia)}`} /> : null}
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
      {vis === "parado" && extra.faixas?.length ? (
        <div className="flex gap-2 flex-wrap">
          {extra.faixas.map((f) => (
            <button key={f.faixa} type="button" className={botaoClass} style={diasMin === LIM_FAIXA[f.faixa] ? botaoPrimarioStyle : botaoStyle}
              title="Mostrar a partir desta faixa" onClick={() => setDiasMin(LIM_FAIXA[f.faixa] ?? 0)}>
              {f.faixa}: {num(f.produtos)} prod. · {brl(f.valor)}
            </button>
          ))}
        </div>
      ) : null}

      {dados ? (
        <div className="cartao p-3 overflow-x-auto">
          <table className="w-full text-sm" style={{ color: "var(--text-primary)" }}>
            <Cabecalho vis={vis} todas={!empresa} />
            <tbody>
              {vis === "fornecedor" || vis === "grupo"
                ? (itens as AudGrupoLinha[]).map((g) => (
                    <GrupoLinha key={g.chave} g={g} aberto={aberto === g.chave} itens={aberto === g.chave ? itensGrupo : []} onAbrir={() => void abrirGrupo(g.chave)} />
                  ))
                : itens.map((i, n) => <Linha key={n} vis={vis} item={i} todas={!empresa} />)}
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
  if (vis === "fornecedor" || vis === "grupo")
    return (
      <thead>
        <tr style={c}>
          <th className={th}>{vis === "fornecedor" ? "Fornecedor" : "Grupo"}</th>
          <th className={thR}>Produtos</th>
          <th className={thR}>Com saldo</th>
          <th className={thR}>Quantidade</th>
          <th className={thR}>Valor (custo)</th>
        </tr>
      </thead>
    );
  if (vis === "geral")
    return (
      <thead>
        <tr style={c}>
          <th className={th}>Produto</th>
          <th className={th}>Grupo / fornecedor</th>
          <th className={thR}>Saldo</th>
          <th className={thR}>Reservado</th>
          <th className={thR}>Custo médio</th>
          <th className={thR}>Valor</th>
        </tr>
      </thead>
    );
  if (vis === "parado" || vis === "giro")
    return (
      <thead>
        <tr style={c}>
          <th className={th}>Produto</th>
          <th className={thR}>Saldo</th>
          <th className={thR}>Valor</th>
          <th className={thR}>Última saída</th>
          <th className={thR}>Dias sem saída</th>
          {vis === "giro" ? (
            <>
              <th className={thR}>Saídas 30 d</th>
              <th className={thR}>Saídas 90 d</th>
              <th className={thR}>Média/dia</th>
              <th className={thR}>Cobertura</th>
            </>
          ) : (
            <th className={th}>Faixa</th>
          )}
        </tr>
      </thead>
    );
  if (vis === "posicao" || vis === "negativo")
    return (
      <thead>
        <tr style={c}>
          <th className={th}>Produto</th>
          {todas || vis === "negativo" ? <th className={th}>Loja</th> : null}
          <th className={thR}>Físico</th>
          <th className={thR}>Reservado</th>
          <th className={thR}>Disponível</th>
          {vis === "posicao" ? (
            <>
              <th className={thR}>Avaria</th>
              <th className={thR}>Assistência</th>
            </>
          ) : null}
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
  if (vis === "geral") {
    const i = item as AudGeralItem;
    return (
      <tr style={borda}>
        <td className={td}>
          <b>{i.codigo}</b> {i.produto}
        </td>
        <td className={td}>
          <div className="text-xs">{i.categoria}</div>
          <div className="text-xs" style={muted}>{i.fornecedor}</div>
        </td>
        <td className={tdR} style={i.fisico < 0 ? ruim : undefined}>{num(i.fisico)}</td>
        <td className={tdR}>{num(i.reservado)}</td>
        <td className={tdR}>{i.custo_medio ? brl(i.custo_medio) : "—"}</td>
        <td className={tdR}>{brl(i.valor)}</td>
      </tr>
    );
  }
  if (vis === "parado" || vis === "giro") {
    const i = item as AudRotItem;
    return (
      <tr style={borda}>
        <td className={td}>
          <b>{i.codigo}</b> {i.produto}
          <div className="text-xs" style={muted}>{i.categoria}</div>
        </td>
        <td className={tdR}>{num(i.fisico)}</td>
        <td className={tdR}>{brl(i.valor)}</td>
        <td className={tdR}>{i.ultima_saida ? dia(i.ultima_saida) : "—"}</td>
        <td className={tdR} style={i.dias_sem_saida === null || i.dias_sem_saida >= 90 ? ruim : undefined}>
          {i.dias_sem_saida === null ? "nunca saiu" : num(i.dias_sem_saida)}
        </td>
        {vis === "giro" ? (
          <>
            <td className={tdR}>{num(i.saidas_30)}</td>
            <td className={tdR}>{num(i.saidas_90)}</td>
            <td className={tdR}>{num(i.media_dia)}</td>
            <td className={tdR}>{i.cobertura_dias === null ? "—" : `${num(i.cobertura_dias)} dias`}</td>
          </>
        ) : (
          <td className={td}>{i.faixa}</td>
        )}
      </tr>
    );
  }
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
        {vis === "posicao" ? (
          <>
            <td className={tdR}>{i.avaria ? num(i.avaria) : "—"}</td>
            <td className={tdR}>{i.assistencia ? num(i.assistencia) : "—"}</td>
          </>
        ) : null}
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

function GrupoLinha({ g, aberto, itens, onAbrir }: { g: AudGrupoLinha; aberto: boolean; itens: AudGeralItem[]; onAbrir: () => void }) {
  const muted = { color: "var(--text-secondary)" };
  return (
    <>
      <tr style={{ borderTop: "1px solid var(--border)", cursor: "pointer" }} onClick={onAbrir} title="Clique para ver os produtos">
        <td className="py-2 pr-3">
          {aberto ? "▾" : "▸"} <b>{g.nome}</b>
        </td>
        <td className="py-2 pr-3 text-right">{num(g.produtos)}</td>
        <td className="py-2 pr-3 text-right">{num(g.com_saldo)}</td>
        <td className="py-2 pr-3 text-right">{num(g.qtd)}</td>
        <td className="py-2 pr-3 text-right"><b>{brl(g.valor)}</b></td>
      </tr>
      {aberto ? (
        <tr>
          <td colSpan={5} className="pb-3 pl-6">
            {!itens.length ? (
              <span className="text-xs" style={muted}>Carregando…</span>
            ) : (
              <table className="w-full text-xs">
                <tbody>
                  {itens.map((i) => (
                    <tr key={i.product_id} style={{ borderTop: "1px dashed var(--border)" }}>
                      <td className="py-1 pr-3"><b>{i.codigo}</b> {i.produto}</td>
                      <td className="py-1 pr-3" style={muted}>{i.categoria} · {i.fornecedor}</td>
                      <td className="py-1 pr-3 text-right">{num(i.fisico)}</td>
                      <td className="py-1 pr-3 text-right">{i.custo_medio ? brl(i.custo_medio) : "—"}</td>
                      <td className="py-1 pr-3 text-right">{brl(i.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      ) : null}
    </>
  );
}
