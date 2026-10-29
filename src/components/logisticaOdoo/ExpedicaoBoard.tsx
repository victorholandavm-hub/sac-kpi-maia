"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { acaoEntregaAction, buscarEntregasAction, historicoClienteAction, incluirNaCargaAction, montarCargaAction } from "@/app/assistencia/logistica/logistica-actions";
import type { BuscaEntrega, HistCliente } from "@/lib/odoo/logistica";
import { useEffect } from "react";
import {
  CATEGORIA_LABELS,
  MODO_LABELS,
  SEM_ZONA,
  TIPO_CARGA_LABELS,
  filtrarExpedicao,
  formatarDiaIso,
  somarVolumes,
  zonaUnica,
  ESTADO_CARGA_LABELS,
  type AcaoEntrega,
  type CargaOdoo,
  type CatalogosOdoo,
  type EmpresaOdoo,
  type EntregaOdoo,
  type ExpedicaoResposta,
  type VisaoExpedicao,
} from "@/lib/odoo/logisticaTipos";
import { AcaoEntregaDialog, type AlvoEntrega } from "./AcaoEntregaDialog";
import { useAcaoOdoo } from "./useAcaoOdoo";
import { Chip, Kpi, VolumesChips, botaoClass, botaoLaranjaStyle, botaoStyle, inputClass, inputStyle } from "./ui";

// 27/10 (Rafael/John: "observações dos pedidos não aparecem na expedição"): a nota do pedido vem como
// "<obs do vendedor> | entrega: … | frete … | pagto: […]" — mostra só a parte do vendedor
function obsVendedor(nota?: string | null): string {
  const t = (nota || "").split(/\s*\|\s*entrega:/)[0].replace(/pagto(_caixa)?:[\s\S]*$/, "").trim();
  return t.length > 300 ? t.slice(0, 300) + "…" : t;
}

const VISOES: { id: VisaoExpedicao; label: string }[] = [
  { id: "fila", label: "Fila (sem carga)" },
  { id: "pendencias", label: "Pendências do CD" },
  { id: "retornos", label: "Retornos" },
];

export function ExpedicaoBoard({
  companyId,
  expedicao,
  catalogos,
  empresas,
  cargasAbertas = [],
  sac = false,
}: {
  companyId: number;
  expedicao: ExpedicaoResposta;
  catalogos: CatalogosOdoo;
  empresas: EmpresaOdoo[];
  cargasAbertas?: CargaOdoo[];
  // 29/10 (Victor): a Expedição do SAC -- observações e as ações por entrega
  // (com "Nota de entrega" = faturar a 5117 e dar baixa), sem montar carga.
  sac?: boolean;
}) {
  const router = useRouter();
  const { pending, run } = useAcaoOdoo();
  const [visao, setVisao] = useState<VisaoExpedicao>("fila");
  const [zona, setZona] = useState("");
  const [modo, setModo] = useState("");
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [alvo, setAlvo] = useState<AlvoEntrega | null>(null);
  const [cargaDestino, setCargaDestino] = useState("");
  // 26/10: busca em TUDO (carga, rota, entregue, pendência, loja) além da fila
  const [fora, setFora] = useState<BuscaEntrega[]>([]);
  useEffect(() => {
    const q = busca.trim();
    if (q.length < 3) return;
    const t = setTimeout(() => {
      buscarEntregasAction(q).then((r) => setFora(r.ok ? (r.dados ?? []).filter((x) => !x.na_fila) : [])).catch(() => setFora([]));
    }, 500);
    return () => clearTimeout(t);
  }, [busca]);
  // 27/10 (Pedro): buscando cliente/CPF, mostrar também o histórico do sistema antigo (se já foi entregue, em qual carga)
  const [hist, setHist] = useState<HistCliente[]>([]);
  const [histCarregando, setHistCarregando] = useState(false);
  useEffect(() => {
    const q = busca.trim();
    const digitos = q.replace(/\D/g, "");
    const pareceCliente = digitos.length === 11 || digitos.length === 14 || /[A-Za-zÀ-ú]{3,}\s+[A-Za-zÀ-ú]{2,}/.test(q);
    if (!pareceCliente) return;
    const t = setTimeout(() => {
      setHistCarregando(true);
      historicoClienteAction(q).then((r) => setHist(r.ok ? r.dados ?? [] : [])).catch(() => setHist([])).finally(() => setHistCarregando(false));
    }, 800);
    return () => clearTimeout(t);
  }, [busca]);
  const buscaEhCliente = (() => { const q = busca.trim(); const d = q.replace(/\D/g, ""); return d.length === 11 || d.length === 14 || /[A-Za-zÀ-ú]{3,}\s+[A-Za-zÀ-ú]{2,}/.test(q); })();
  const [form, setForm] = useState({ tipo: "entrega", zona_id: "", motorista_id: "", veiculo_id: "", descricao: "", transportadora: "", data_prevista: "" });

  const todas = useMemo(() => [...expedicao.entregas, ...expedicao.pendencias], [expedicao]);
  const modos = useMemo(() => {
    const m = [...new Set(todas.map((e) => e.modo).filter(Boolean))].sort();
    if (todas.some((e) => e.expresso)) m.push("expresso");
    return m;
  }, [todas]);
  const temRetornoNoOdoo = todas.some((e) => typeof e.retorno === "boolean");
  const lista = filtrarExpedicao(expedicao.entregas, expedicao.pendencias, { visao, zona, modo, busca });
  const vols = somarVolumes(lista);
  const selecionadas = [...expedicao.entregas, ...expedicao.pendencias].filter((e) => sel.has(e.picking_id));
  // 27/10 (CD: "cliente da pendência, não tem a opção de marcar"): pendência marcada volta à fila antes de entrar na carga
  async function tirarPendencias() {
    const ids = [...sel].filter((id) => expedicao.pendencias.some((p) => p.picking_id === id));
    for (const id of ids) {
      const r = await acaoEntregaAction(id, "fila", null);
      if (!r.ok) throw new Error(`Não consegui tirar da pendência: ${r.erro}`);
    }
  }
  const volsSel = somarVolumes(selecionadas);

  function alternar(id: number) {
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function selecionarVisiveis() {
    setSel(new Set(lista.map((e) => e.picking_id)));
  }

  function abrirMontar() {
    const z = zonaUnica(selecionadas);
    if (z && !form.zona_id) setForm((f) => ({ ...f, zona_id: String(z) }));
  }

  // 27/10: com a fila de todas as empresas, a carga nasce na empresa da fila das saídas marcadas (CD = 213 na maioria)
  function empresaDaSelecao(): number | null {
    const emps = new Set([...sel].map((id) => todas.find((e) => e.picking_id === id)?.empresa_id ?? companyId));
    if (emps.size > 1) {
      const nomes = [...new Set([...sel].map((id) => todas.find((e) => e.picking_id === id)?.empresa_nome ?? "?"))].join(", ");
      window.alert(`As saídas marcadas são de filas diferentes (${nomes}). Monte uma carga para cada fila, ou use o seletor de empresa.`);
      return null;
    }
    return [...emps][0] ?? companyId;
  }

  function montar() {
    const n = (v: string) => (v ? Number(v) : null);
    const empresaCarga = empresaDaSelecao();
    if (empresaCarga == null) return;
    // 27/10 (John): "criar carga sem necessariamente ter que selecionar um pedido"
    if (sel.size === 0 && !window.confirm("Criar a carga VAZIA, sem pedidos? Depois é só marcar as saídas e usar \"Incluir na carga\".")) return;
    run(
      () =>
        tirarPendencias().then(() => montarCargaAction({
          company_id: empresaCarga,
          picking_ids: [...sel],
          tipo: form.tipo,
          zona_id: n(form.zona_id),
          motorista_id: n(form.motorista_id),
          veiculo_id: n(form.veiculo_id),
          descricao: form.descricao || null,
          transportadora: form.transportadora || null,
          data_prevista: form.data_prevista || null,
        })),
      (c) => (c.qtd_paradas ? `Carga ${c.romaneio} montada com ${c.qtd_paradas} parada(s).` : `Carga ${c.romaneio} criada vazia — inclua os pedidos quando quiser.`),
      (c) => {
        setSel(new Set());
        router.push(`/assistencia/logistica/cargas/${c.carga_id}?empresa=${empresaCarga}`);
      },
    );
  }

  // 26/10 (Jhon): "deveria dar a opção (montar carga) ou (mover para existente)"
  function incluirExistente() {
    const c = cargasAbertas.find((x) => String(x.carga_id) === cargaDestino);
    run(
      () => tirarPendencias().then(() => incluirNaCargaAction(Number(cargaDestino), [...sel])),
      (r) => `${sel.size} saída(s) incluída(s) na carga ${r.romaneio ?? c?.romaneio ?? ""}.`,
      () => {
        setSel(new Set());
        router.push(`/assistencia/logistica/cargas/${cargaDestino}?empresa=${companyId}`);
      },
    );
  }

  function acao(e: EntregaOdoo, a: AcaoEntrega | "nota_entrega") {
    const notaEntrega = a === "nota_entrega";
    setAlvo({ pickingId: e.picking_id, nome: e.nome, cliente: e.cliente, acao: notaEntrega ? "retirada_cd" : a, companyId: e.empresa_id ?? companyId, notaEntrega });
  }

  return (
    <div className="flex flex-col gap-4 min-w-0">
      <div className="cartao p-4 flex flex-col gap-3">
        <div className="flex gap-2 flex-wrap">
          {VISOES.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => {
                setVisao(v.id);
                setSel(new Set());
              }}
              className="text-xs px-3 py-1.5 rounded-full border"
              style={{
                borderColor: "var(--border)",
                background: visao === v.id ? "var(--brand-green)" : "transparent",
                color: visao === v.id ? "var(--brand-green-ink)" : "var(--text-secondary)",
                fontWeight: visao === v.id ? 700 : 500,
              }}
            >
              {v.label}
              {v.id === "pendencias" ? ` (${expedicao.total_pendencias})` : v.id === "fila" ? ` (${expedicao.total})` : ""}
            </button>
          ))}
        </div>
        {visao === "retornos" && !temRetornoNoOdoo ? (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            O Odoo ainda não marca as saídas que voltaram de rota (falta o campo “retorno” na API). Assim que vier, esta visão enche sozinha.
          </p>
        ) : null}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <select value={zona} onChange={(e) => setZona(e.target.value)} className={inputClass} style={inputStyle} aria-label="Região">
            <option value="">Todas as regiões</option>
            <option value={SEM_ZONA}>Sem região</option>
            {catalogos.zonas.map((z) => (
              <option key={z.id} value={z.nome}>
                {z.nome} {expedicao.por_zona[z.nome] ? `(${expedicao.por_zona[z.nome]})` : ""}
              </option>
            ))}
          </select>
          <select value={modo} onChange={(e) => setModo(e.target.value)} className={inputClass} style={inputStyle} aria-label="Modo">
            <option value="">Todos os modos (entrega, retira ABA…)</option>
            {modos.map((m) => (
              <option key={m} value={m}>
                {MODO_LABELS[m] ?? m}
              </option>
            ))}
          </select>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Cliente, pedido, bairro, CEP, NF" className={inputClass} style={inputStyle} />
          <div className="flex gap-2">
            <button type="button" onClick={() => router.refresh()} className={botaoClass} style={botaoStyle}>
              Atualizar
            </button>
            {!sac ? (
              <button type="button" onClick={selecionarVisiveis} className={botaoClass} style={botaoStyle}>
                Selecionar visíveis
              </button>
            ) : null}
          </div>
        </div>
        <div className="grid gap-2 grid-cols-2 sm:grid-cols-4 lg:grid-cols-7">
          <Kpi rotulo="Saídas" valor={lista.length} />
          {Object.entries(vols).map(([k, v]) => (
            <Kpi key={k} rotulo={CATEGORIA_LABELS[k] ?? k} valor={v} />
          ))}
        </div>
      </div>

      {/* 25/10 (Pedro): quadro de montar SEMPRE à vista — descrição e data programada visíveis antes de marcar */}
      {!sac ? (
        <div className="cartao p-4 flex flex-col gap-3" style={{ border: sel.size ? "2px solid var(--brand-orange)" : "1px solid var(--border)" }} onFocus={abrirMontar} onMouseEnter={abrirMontar}>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="font-bold" style={{ color: "var(--text-primary)" }}>
              {sel.size ? `Montar carga com ${sel.size} saída(s)` : "Montar carga — marque as saídas abaixo, ou crie a carga vazia"}
            </h3>
            <VolumesChips volumes={volsSel} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Campo rotulo="Tipo">
              <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className={inputClass} style={inputStyle}>
                {Object.entries(catalogos.tipos_carga && Object.keys(catalogos.tipos_carga).length ? catalogos.tipos_carga : TIPO_CARGA_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {TIPO_CARGA_LABELS[k] ?? v}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Região">
              <select value={form.zona_id} onChange={(e) => setForm({ ...form, zona_id: e.target.value })} className={inputClass} style={inputStyle}>
                <option value="">— sem região —</option>
                {catalogos.zonas.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.codigo} · {z.nome}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Motorista">
              <select value={form.motorista_id} onChange={(e) => setForm({ ...form, motorista_id: e.target.value })} className={inputClass} style={inputStyle}>
                <option value="">— definir depois —</option>
                {catalogos.motoristas.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Veículo">
              <select value={form.veiculo_id} onChange={(e) => setForm({ ...form, veiculo_id: e.target.value })} className={inputClass} style={inputStyle}>
                <option value="">— definir depois —</option>
                {catalogos.veiculos.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nome}
                    {v.placa ? ` · ${v.placa}` : ""}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Descrição">
              <input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="ex.: A TARDE, ABA BARÃO" className={inputClass} style={inputStyle} />
            </Campo>
            <Campo rotulo="Transportadora">
              <input value={form.transportadora} onChange={(e) => setForm({ ...form, transportadora: e.target.value })} placeholder="ex.: Lojas Maia, D&A" className={inputClass} style={inputStyle} />
            </Campo>
            <Campo rotulo="Data programada (saída)">
              <input type="date" value={form.data_prevista} onChange={(e) => setForm({ ...form, data_prevista: e.target.value })} className={inputClass} style={inputStyle} />
            </Campo>
            <div className="flex items-end gap-2">
              <button type="button" disabled={pending} onClick={montar} className={`${botaoClass} flex-1`} style={botaoLaranjaStyle}>
                {pending ? "Montando no Odoo…" : sel.size ? "Montar carga" : "Criar carga vazia"}
              </button>
              <button type="button" onClick={() => setSel(new Set())} className={botaoClass} style={botaoStyle}>
                Limpar
              </button>
            </div>
          </div>
          <div className="flex items-end gap-2 flex-wrap" style={{ borderTop: "1px dashed var(--border)", paddingTop: 8 }}>
            <Campo rotulo="…ou incluir as saídas marcadas numa carga que ainda não saiu">
              <select value={cargaDestino} onChange={(e) => setCargaDestino(e.target.value)} className={inputClass} style={{ ...inputStyle, minWidth: 320 }} aria-label="Carga existente">
                <option value="">— escolher a carga —</option>
                {cargasAbertas.map((c) => (
                  <option key={c.carga_id} value={c.carga_id}>
                    {c.romaneio} · {ESTADO_CARGA_LABELS[c.estado] ?? c.estado}
                    {c.zona ? ` · ${c.zona}` : ""}
                    {c.descricao ? ` · ${c.descricao}` : ""}
                    {c.data_prevista ? ` · ${formatarDiaIso(c.data_prevista)}` : ""}
                    {c.motorista ? ` · ${c.motorista}` : ""} ({c.qtd_pedidos} pedidos)
                  </option>
                ))}
              </select>
            </Campo>
            <button type="button" disabled={pending || sel.size === 0 || !cargaDestino} onClick={incluirExistente} className={botaoClass} style={botaoStyle}>
              {pending ? "Incluindo…" : "Incluir na carga existente"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="cartao p-0 overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide" style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
              <th className="p-2 w-8" />
              <th className="p-2">Cliente</th>
              <th className="p-2">Pedido · NF</th>
              <th className="p-2">Região · endereço</th>
              <th className="p-2">Programada</th>
              <th className="p-2">Modo</th>
              <th className="p-2">Volumes · itens</th>
              <th className="p-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-6 text-center" style={{ color: "var(--text-muted)" }}>
                  Nenhuma saída aqui.
                </td>
              </tr>
            ) : null}
            {lista.map((e) => {
              const marcada = sel.has(e.picking_id);
              return (
                <tr key={e.picking_id} style={{ borderBottom: "1px solid var(--border)", background: marcada ? "var(--brand-green-soft)" : undefined }}>
                  <td className="p-2 align-top">
                    {/* 28/10 (Rafael): retorno também pode ir para outra carga */}
                    {!sac ? <input type="checkbox" checked={marcada} onChange={() => alternar(e.picking_id)} aria-label={`Selecionar ${e.cliente}`} className="w-5 h-5" /> : null}
                  </td>
                  <td className="p-2 align-top">
                    <b style={{ color: "var(--text-primary)" }}>{e.cliente}</b>
                    {e.vendedor ? <div className="text-xs" style={{ color: "var(--text-secondary)" }}>Vend.: {e.vendedor}</div> : null}
                    <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      {e.telefone}
                    </div>
                    {e.dias !== null ? (
                      <div className="text-xs" style={{ color: e.dias > 3 ? "var(--status-critical)" : "var(--text-muted)" }}>
                        {e.dias} dia(s) desde a venda
                      </div>
                    ) : null}
                  </td>
                  <td className="p-2 align-top">
                    {e.pedido || e.origem}
                    <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      {e.nome}
                      {e.empresa_nome ? <> · fila <b>{e.empresa_nome}</b></> : null}
                    </div>
                    {e.nf5922 ? <Chip>5922 nº {e.nf5922}</Chip> : <Chip cor="var(--status-critical)">sem nota</Chip>}
                    {e.nf5117 ? <Chip forte>5117 nº {e.nf5117}</Chip> : null}
                    {e.chave5117 ? (
                      <a href={`/assistencia/logistica/pdf/nota/${e.chave5117}`} target="_blank" rel="noopener noreferrer" className="text-xs underline ml-1" title="DANFE da nota de entrega (vai com a mercadoria)">🖨 5117</a>
                    ) : null}
                    {e.chave5922 ? (
                      <a href={`/assistencia/logistica/pdf/nota/${e.chave5922}`} target="_blank" rel="noopener noreferrer" className="text-xs underline ml-1" title="DANFE da nota de venda">🖨 5922</a>
                    ) : null}
                  </td>
                  <td className="p-2 align-top">
                    {e.zona ? <Chip forte>{e.zona}</Chip> : <Chip>sem região</Chip>}
                    {e.filial_entrega ? <Chip cor="var(--status-info)">vendida na {e.nome.split(" ")[0]} · entrega {e.filial_entrega}</Chip> : null}
                    {e.retira_em ? <Chip cor="var(--brand-orange)">retira na loja {e.retira_em}</Chip> : null}
                    {e.expresso ? <Chip cor="var(--status-serious)">EXPRESS</Chip> : null}
                    <div className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                      {e.endereco}
                    </div>
                  </td>
                  <td className="p-2 align-top whitespace-nowrap">{formatarDiaIso(e.data_programada || null)}</td>
                  <td className="p-2 align-top">{MODO_LABELS[e.modo] ?? e.modo}</td>
                  <td className="p-2 align-top">
                    <VolumesChips volumes={e.volumes_por_categoria} total={e.volumes} />
                    <div className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                      {e.itens.map((i, idx) => (
                        <div key={idx}>
                          {i.qtd}× {i.codigo || ""} {i.nome.slice(0, 40)}
                        </div>
                      ))}
                    </div>
                    {e.pendencia ? <Chip cor="var(--status-serious)">pendência: {e.pendencia_motivo}</Chip> : null}
                    {obsVendedor(e.obs) ? (
                      <div className="text-xs mt-1 rounded px-2 py-1" style={{ background: "#FFF3C4", color: "#5C4400" }}>
                        📝 Obs. do pedido: {obsVendedor(e.obs)}
                      </div>
                    ) : null}
                    {e.anotacao ? (
                      <div className="text-xs italic mt-1" style={{ color: "var(--text-muted)" }}>
                        {e.anotacao.slice(-140)}
                      </div>
                    ) : null}
                  </td>
                  <td className="p-2 align-top">
                    <select
                      value=""
                      onChange={(ev) => ev.target.value && acao(e, ev.target.value as AcaoEntrega | "nota_entrega")}
                      className="rounded-lg border px-2 py-1 text-xs"
                      style={inputStyle}
                      aria-label={`Ações de ${e.cliente}`}
                    >
                      <option value="">Ações…</option>
                      {e.pendencia ? <option value="fila">Voltar à fila</option> : <option value="pendencia">Enviar para pendência</option>}
                      <option value="programar">Data programada</option>
                      {sac ? <option value="nota_entrega">Nota de entrega (faturar e dar baixa)</option> : null}
                      <option value="retirada_cd">Cliente/fretista retirou no CD</option>
                      <option value="transferir_filial">Transferir filial</option>
                      <option value="anotar">Anotação</option>
                      <option value="historico">Histórico</option>
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {busca.trim().length >= 3 && fora.length ? (
        <div className="cartao p-4 flex flex-col gap-2">
          <h3 className="font-bold" style={{ color: "var(--text-primary)" }}>
            Fora da fila (em carga, em rota, entregue, pendência ou na loja) · {fora.length}
          </h3>
          {fora.map((x) => (
            <div key={x.picking_id} className="flex items-start justify-between gap-2 text-sm py-1 flex-wrap" style={{ borderBottom: "1px solid var(--border)" }}>
              <span>
                <b>{x.cliente}</b> · {x.pedido} · loja {x.loja} · {x.nota}
                <br />
                <span style={{ color: x.cor === "alerta" ? "var(--status-critical)" : x.cor === "info" ? "var(--status-info)" : "var(--status-good)", fontWeight: 600 }}>
                  {x.situacao}
                </span>
              </span>
              {x.carga_id ? (
                <a href={`/assistencia/logistica/cargas/${x.carga_id}?empresa=${companyId}`} className="text-sm underline">
                  abrir carga
                </a>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {histCarregando && buscaEhCliente ? (
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Buscando o histórico do sistema antigo…</p>
      ) : null}
      {buscaEhCliente && hist.some((c) => (c.vendas?.length ?? 0) > 0 || (c.pendentes_antigo?.length ?? 0) > 0 || c.erro) ? (
        <div className="cartao p-3 flex flex-col gap-2">
          <h3 className="font-bold" style={{ color: "var(--text-primary)" }}>Histórico do sistema antigo (até 24/10)</h3>
          {hist.map((c) => (
            <div key={c.cpf} className="flex flex-col gap-1">
              <div className="text-sm"><b>{c.nome}</b> · {c.cpf}{c.cidade ? ` · ${c.cidade}` : ""}{c.erro ? ` · ${c.erro}` : ""}</div>
              {(c.vendas ?? []).map((v) => (
                <div key={`${v.loja}-${v.nf}`} className="text-sm py-1" style={{ borderBottom: "1px solid var(--border)" }}>
                  <div>
                    Loja <b>{v.loja}</b> · {v.tipo === "5922" ? "venda" : v.tipo} nº <b>{v.nf}</b> · {formatarDiaIso(v.data)}
                    {v.no_sistema ? (
                      <span style={{ color: "var(--status-info)", fontWeight: 600 }}> · no sistema novo: {v.no_sistema.pedido} — {v.no_sistema.situacao}</span>
                    ) : null}
                  </div>
                  <div style={{ color: "var(--text-secondary)" }}>
                    {v.itens.map((i) => `${i.qtd}× ${i.codigo} ${i.nome}`).join(" · ")}
                  </div>
                  {v.entregas.length ? v.entregas.map((e) => (
                    <div key={e.nf}>
                      entrega nº {e.nf}{e.como ? <> — <b>{e.como}</b></> : null}
                      {e.atencao ? (
                        <div className="px-2 py-1 rounded mt-1" style={{ background: "#FFF3BF", color: "#5C4400", fontWeight: 700 }}>⚠ {e.atencao}</div>
                      ) : null}
                    </div>
                  )) : <div style={{ color: "var(--status-critical)", fontWeight: 600 }}>sem nota de entrega (pendente)</div>}
                </div>
              ))}
              {(c.pendentes_antigo ?? []).map((p) => (
                <div key={`${p.pedido}-${p.nota}`} className="text-sm py-1" style={{ borderBottom: "1px solid var(--border)", color: "var(--status-serious)" }}>
                  Programado no sistema antigo · loja {p.loja} · pedido {p.pedido}{p.nota ? ` · nota ${p.nota}` : ""} — <b>{p.como}</b>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : null}

      <AcaoEntregaDialog alvo={alvo} empresas={empresas} onFechar={() => setAlvo(null)} />
    </div>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
      {rotulo}
      {children}
    </label>
  );
}
