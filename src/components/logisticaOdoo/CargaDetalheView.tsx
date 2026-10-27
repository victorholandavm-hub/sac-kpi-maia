"use client";

import { useEffect, useRef, useState } from "react";
import type { ProgressoCarga } from "@/lib/odoo/logistica";
import { useRouter } from "next/navigation";
import {
  acaoCargaAction,
  acaoMdfeAction,
  baixarEntregaManualAction,
  itensEntregaAction,
  naoSaiuAction,
  editarCargaAction,
  excluirCargaAction,
  listarDanfesAction,
  reordenarParadasAction,
} from "@/app/assistencia/logistica/logistica-actions";
import {
  ESTADOS_EDITAVEIS,
  ESTADO_CARGA_LABELS,
  PROXIMA_ACAO,
  RESULTADO_LABELS,
  TIPO_CARGA_LABELS,
  formatarDataHoraOdoo,
  formatarDiaIso,
  moverItem,
  type CargaDetalhe,
  type CargaOdoo,
  type CatalogosOdoo,
  type DanfeCarga,
  type EmpresaOdoo,
  type NotaSaida,
  type ParadaOdoo,
} from "@/lib/odoo/logisticaTipos";
import { AcaoEntregaDialog, type AlvoEntrega } from "./AcaoEntregaDialog";
import { ConferenciaCarregamento, type Parciais } from "./ConferenciaCarregamento";
import { useAcaoOdoo } from "./useAcaoOdoo";
import {
  Chip,
  ErroOdoo,
  Kpi,
  VolumesChips,
  botaoClass,
  botaoLaranjaStyle,
  botaoPerigoStyle,
  botaoPrimarioStyle,
  botaoStyle,
  inputClass,
  inputStyle,
} from "./ui";

const COR_RESULTADO: Record<string, string> = {
  entregue: "var(--status-good)",
  entrega_parcial: "var(--status-warning)",
  insucesso: "var(--status-critical)",
  reagendada: "var(--status-info)",
};

// 26/10: GET comum (não server action) para atualizar enquanto o faturamento roda
async function lerProgresso(cargaId: number): Promise<ProgressoCarga | null> {
  try {
    const r = await fetch(`/api/logistica/carga-progresso/${cargaId}`, { cache: "no-store" });
    const j = (await r.json()) as { ok: boolean; dados?: ProgressoCarga };
    return j.ok && j.dados ? j.dados : null;
  } catch {
    return null;
  }
}

export function CargaDetalheView({
  carga,
  catalogos,
  erroCatalogos,
  empresas,
  cargasAbertas = [],
}: {
  carga: CargaDetalhe;
  cargasAbertas?: CargaOdoo[];
  catalogos: CatalogosOdoo | null;
  erroCatalogos: string | null;
  empresas: EmpresaOdoo[];
}) {
  const router = useRouter();
  const { pending, run } = useAcaoOdoo();
  const [ordem, setOrdem] = useState<ParadaOdoo[]>(carga.paradas);
  const [ordemMudou, setOrdemMudou] = useState(false);
  const [motorista, setMotorista] = useState(carga.motorista_id ? String(carga.motorista_id) : "");
  const [veiculo, setVeiculo] = useState(carga.veiculo_id ? String(carga.veiculo_id) : "");
  const [notas, setNotas] = useState<NotaSaida[] | null>(null);
  const [conferindo, setConferindo] = useState(false);
  // 26/10 (Pedro): ao faturar a rota, já emitir o manifesto (MDF-e) — marcado por padrão
  const [emitirMdfe, setEmitirMdfe] = useState(true);
  const [mdfeMsg, setMdfeMsg] = useState<string | null>(null);
  // 26/10 (Pedro): painel animado enquanto as notas são emitidas no "Sair em rota"
  const [emitindo, setEmitindo] = useState(false);
  const [progresso, setProgresso] = useState<ProgressoCarga | null>(null);
  const [painelProg, setPainelProg] = useState(false);
  const comecou = useRef(false);
  // 26/10 (Jhon travado na ROM/2026/00054): a resposta do "Sair" pode não chegar (202 s no servidor) mas as notas
  // continuam saindo. A tela segue lendo o progresso até acabar e só então emite o manifesto.
  const fimResposta = useRef<number | null>(null);
  const mdfeFeito = useRef(false);
  function emitirManifesto() {
    if (mdfeFeito.current) return;
    mdfeFeito.current = true;
    setMdfeMsg("Emitindo o manifesto (MDF-e)…");
    acaoMdfeAction(carga.carga_id, "emitir")
      .then((m) => setMdfeMsg(m.ok ? `Manifesto emitido: nº ${String(m.dados?.numero ?? "")} (${String(m.dados?.estado ?? "")})` : `Manifesto NÃO emitido: ${m.erro}`))
      .catch(() => setMdfeMsg("Manifesto NÃO emitido: falha de comunicação. Tente pela aba Manifesto."));
  }
  // 26/10 (Pedro): clicar na cliente mostra os itens da parada
  const [abertas, setAbertas] = useState<number[]>([]);
  const [estoqueItens, setEstoqueItens] = useState<Record<number, Record<string, boolean>>>({});
  function alternarParada(p: { parada_id: number; pickings: { picking_id: number }[] }) {
    const aberta = abertas.includes(p.parada_id);
    setAbertas((a) => (aberta ? a.filter((x) => x !== p.parada_id) : [...a, p.parada_id]));
    if (aberta) return;
    for (const pk of p.pickings) {
      if (estoqueItens[pk.picking_id]) continue;
      itensEntregaAction(pk.picking_id).then((r) => {
        if (!r.ok || !Array.isArray(r.dados)) return;
        const m: Record<string, boolean> = {};
        for (const it of r.dados) m[it.codigo] = it.tem_estoque;
        setEstoqueItens((e) => ({ ...e, [pk.picking_id]: m }));
      }).catch(() => {});
    }
  }
  const [danfes, setDanfes] = useState<DanfeCarga[] | null>(null);
  const [alvo, setAlvo] = useState<AlvoEntrega | null>(null);
  const [edicao, setEdicao] = useState<{ campo: "programar" | "descricao" | "transportadora"; valor: string } | null>(null);

  // router.refresh() traz paradas novas do Odoo: ressincroniza a ordem local
  // (padrão "ajustar estado quando a prop muda", sem effect).
  const [paradasBase, setParadasBase] = useState(carga.paradas);
  if (paradasBase !== carga.paradas) {
    setParadasBase(carga.paradas);
    setOrdem(carga.paradas);
    setOrdemMudou(false);
  }

  const editavel = ESTADOS_EDITAVEIS.includes(carga.estado);
  const proxima = PROXIMA_ACAO[carga.estado];
  const faltamBaixas = carga.paradas.filter((p) => !p.resultado).length;
  const todosLegado = carga.paradas.length > 0 && carga.paradas.every((p) => p.pickings.every((pk) => pk.legado));

  function sair(parciais: Parciais | null) {
    setProgresso(null); setPainelProg(true); setEmitindo(true); comecou.current = false; fimResposta.current = null; mdfeFeito.current = false; setMdfeMsg(null);
    run(
      () => acaoCargaAction(carga.carga_id, "sair", parciais ? { parciais } : {}),
      (r) => `Carga ${r.romaneio}: ${ESTADO_CARGA_LABELS[r.estado] ?? r.estado}.${parciais ? " O que não foi carregado voltou para a Expedição." : ""}`,
      (r) => {
        setConferindo(false);
        if (r.notas?.length) setNotas(r.notas);
        if (emitirMdfe) emitirManifesto();
      },
    );
  }
  useEffect(() => {
    if (!emitindo) return;
    let vivo = true;
    const ler = () => lerProgresso(carga.carga_id).then((r) => { if (vivo && r) setProgresso(r); });
    ler();
    const t = setInterval(ler, 2000);
    return () => { vivo = false; clearInterval(t); };
  }, [emitindo, carga.carga_id]);
  useEffect(() => {
    if (!emitindo) return;
    if (pending) { comecou.current = true; return; }
    if (comecou.current && fimResposta.current === null) fimResposta.current = Date.now();
  }, [pending, emitindo, carga.carga_id]);
  // depois que a resposta do "Sair" voltou (ou desistiu por tempo): continua lendo o progresso até todas as notas
  // saírem; se a carga não ficou "em rota" é porque a saída falhou de verdade (o aviso de erro já apareceu)
  useEffect(() => {
    if (!emitindo || pending || fimResposta.current === null || !progresso) return;
    const decorrido = Date.now() - fimResposta.current;
    const falhou = progresso.estado !== "em_rota" && decorrido > 4000;
    const acabou = progresso.estado === "em_rota" && progresso.itens.length > 0 && progresso.itens.every((i) => i.estado === "ok" || i.estado === "erro");
    if (falhou || acabou || decorrido > 15 * 60_000) {
      setEmitindo(false);
      if (acabou && emitirMdfe) emitirManifesto();
      router.refresh();
    }
  }, [progresso, pending, emitindo]); // eslint-disable-line react-hooks/exhaustive-deps

  function avancar() {
    if (!proxima) return;
    if (proxima.acao === "sair") { setConferindo(true); return; }   // 26/10: conferência do carregamento antes de sair
    if (proxima.acao === "liberar" && (!motorista || !veiculo)) {
      window.alert("Para liberar, escolha motorista e veículo.");
      return;
    }
    run(
      () =>
        acaoCargaAction(carga.carga_id, proxima.acao, proxima.acao === "liberar" ? { motorista_id: Number(motorista), veiculo_id: Number(veiculo) } : {}),
      (r) => `Carga ${r.romaneio}: ${ESTADO_CARGA_LABELS[r.estado] ?? r.estado}.`,
      (r) => {
        if (r.notas?.length) setNotas(r.notas);
      },
    );
  }

  function salvarOrdem() {
    run(() => reordenarParadasAction(carga.carga_id, ordem.map((p) => p.parada_id)), "Ordem da rota salva.");
  }

  function excluir() {
    if (!window.confirm(`Excluir a carga ${carga.romaneio}? Todas as entregas voltam para a fila.`)) return;
    run(() => excluirCargaAction(carga.carga_id), "Carga excluída; entregas de volta à fila.", () => router.push("/assistencia/logistica/cargas"));
  }

  function naoSaiu(p: ParadaOdoo) {
    const obs = window.prompt(`${p.cliente} NÃO saiu do CD (foi para a rota por engano)? O pedido volta para a fila da Expedição. Motivo (opcional):`, "carregado por engano");
    if (obs === null) return;
    run(() => naoSaiuAction(carga.carga_id, p.parada_id, obs), "Pedido voltou para a fila da Expedição.");
  }

  function baixaManual(p: ParadaOdoo) {
    if (!window.confirm(`Dar baixa manual em ${p.cliente} como ENTREGUE (sem foto nem geo)?`)) return;
    run(() => baixarEntregaManualAction(carga.carga_id, p.parada_id), "Baixa manual registrada.");
  }

  function carregarDanfes() {
    run(() => listarDanfesAction(carga.carga_id), undefined, (l) => setDanfes(l));
  }

  function salvarEdicao() {
    if (!edicao) return;
    run(() => editarCargaAction(carga.carga_id, edicao.campo, edicao.valor), "Carga atualizada.", () => setEdicao(null));
  }

  return (
    <div className="flex flex-col gap-4 min-w-0">
      <div className="cartao p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2 flex-wrap" style={{ color: "var(--text-primary)" }}>
              {carga.romaneio}
              <Chip forte>{ESTADO_CARGA_LABELS[carga.estado] ?? carga.estado}</Chip>
              <Chip>{TIPO_CARGA_LABELS[carga.tipo] ?? carga.tipo}</Chip>
            </h2>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {[carga.descricao, carga.transportadora, carga.data_prevista ? `programada ${formatarDiaIso(carga.data_prevista)}` : ""].filter(Boolean).join(" · ") || "sem descrição"}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {proxima ? (
              <button type="button" disabled={pending} onClick={avancar} className={botaoClass} style={proxima.acao === "sair" ? botaoLaranjaStyle : botaoPrimarioStyle}>
                {pending ? "Enviando ao Odoo…" : proxima.acao === "sair" && todosLegado ? "Sair em rota · notas já emitidas no sistema antigo (não emite nota)" : proxima.label}
              </button>
            ) : null}
            <a href={`/assistencia/logistica/pdf/romaneio/${carga.carga_id}`} target="_blank" rel="noopener noreferrer" className={botaoClass} style={botaoStyle}>
              Romaneio (PDF)
            </a>
            <a href={`/assistencia/logistica/pdf/danfes/${carga.carga_id}`} target="_blank" rel="noopener noreferrer" className={botaoClass} style={botaoLaranjaStyle}
              title="Um PDF só com a transferência (5152), a nota de cada cliente e as notas de entrega">
              🖨 Imprimir todas as notas (transferência + clientes)
            </a>
            <button type="button" disabled={pending} onClick={carregarDanfes} className={botaoClass} style={botaoStyle}>
              DANFEs
            </button>
            {editavel ? (
              <>
                <button type="button" onClick={() => setEdicao({ campo: "programar", valor: carga.data_prevista || "" })} className={botaoClass} style={botaoStyle}>
                  Data programada
                </button>
                <button type="button" onClick={() => setEdicao({ campo: "descricao", valor: carga.descricao })} className={botaoClass} style={botaoStyle}>
                  Descrição
                </button>
                <button type="button" onClick={() => setEdicao({ campo: "transportadora", valor: carga.transportadora })} className={botaoClass} style={botaoStyle}>
                  Transportadora
                </button>
                <button type="button" disabled={pending} onClick={excluir} className={botaoClass} style={botaoPerigoStyle}>
                  Excluir carga
                </button>
              </>
            ) : null}
          </div>
        </div>

        {conferindo && carga.estado === "liberada" ? (
          <>
            <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-primary)" }}>
              <input type="checkbox" checked={emitirMdfe} onChange={(e) => setEmitirMdfe(e.target.checked)} /> Emitir também o manifesto (MDF-e) depois de sair
            </label>
            <ConferenciaCarregamento carga={carga} pending={pending} onConfirmar={sair} onCancelar={() => setConferindo(false)} />
          </>
        ) : null}
        {painelProg ? (
          <div>
            <div className="cartao p-4 w-full flex flex-col gap-2" style={{ borderColor: "var(--brand-green, #1B7E3B)" }}>
              <h3 className="font-bold">{emitindo ? "Emitindo as notas…" : "Notas emitidas"} {progresso ? `· ${progresso.carga}` : ""}</h3>
              <div className="text-sm">{progresso ? `${progresso.feitos} de ${progresso.total} notas` : "Preparando…"}{progresso && progresso.erros ? ` · ${progresso.erros} com erro` : ""}</div>
              <div style={{ height: 10, borderRadius: 6, background: "var(--border)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${progresso && progresso.total ? Math.round((progresso.feitos / progresso.total) * 100) : 5}%`, background: "var(--brand-green, #1B7E3B)", transition: "width .6s ease" }} className={emitindo ? "animate-pulse" : ""} />
              </div>
              <div className="flex flex-col gap-1 text-sm">
                {(progresso?.itens ?? []).map((it) => (
                  <div key={it.pedido} className="flex items-center gap-2">
                    <span style={{ width: 22, display: "inline-block" }} className={it.estado === "emitindo" ? "animate-spin" : ""}>{it.estado === "ok" ? "✅" : it.estado === "erro" ? "❌" : it.estado === "emitindo" ? "🔄" : "⏳"}</span>
                    <span className="flex-1">{it.cliente} <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{it.pedido}</span></span>
                    <span className="text-xs">{it.nf ? `NF nº ${it.nf}` : it.estado === "erro" ? it.sefaz || "erro" : ""}</span>
                  </div>
                ))}
              </div>
              {!emitindo ? (
                <button type="button" className={botaoClass} style={botaoPrimarioStyle} onClick={() => setPainelProg(false)}>Fechar</button>
              ) : <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{pending ? "Não feche a tela: as notas estão sendo enviadas à SEFAZ." : "O servidor continua emitindo as notas; esta tela acompanha até a última e depois emite o manifesto."}</p>}
            </div>
          </div>
        ) : null}
        {mdfeMsg ? (
          <p className="text-sm" style={{ color: mdfeMsg.includes("NÃO") ? "var(--status-critical)" : "var(--text-secondary)" }}>{mdfeMsg}</p>
        ) : null}
        {carga.estado === "em_rota" && proxima?.acao === "finalizar" && faltamBaixas > 0 ? (
          <p className="text-xs" style={{ color: "var(--status-serious)" }}>
            Fim de rota só depois do resultado de todas as paradas (faltam {faltamBaixas}). O motorista dá baixa no app; o CD pode dar baixa manual abaixo.
          </p>
        ) : null}

        {edicao ? (
          <div className="flex gap-2 flex-wrap items-end">
            <input
              type={edicao.campo === "programar" ? "date" : "text"}
              value={edicao.valor}
              onChange={(e) => setEdicao({ ...edicao, valor: e.target.value })}
              className={`${inputClass} max-w-xs`}
              style={inputStyle}
              aria-label={edicao.campo}
              autoFocus
            />
            <button type="button" disabled={pending} onClick={salvarEdicao} className={botaoClass} style={botaoPrimarioStyle}>
              Salvar
            </button>
            <button type="button" onClick={() => setEdicao(null)} className={botaoClass} style={botaoStyle}>
              Cancelar
            </button>
          </div>
        ) : null}

        <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          <Kpi rotulo="Região" valor={<span className="text-base">{carga.zona || "—"}</span>} />
          <Kpi rotulo="Motorista" valor={<span className="text-base">{carga.motorista || "—"}</span>} />
          <Kpi rotulo="Veículo" valor={<span className="text-base">{carga.veiculo || "—"}</span>} />
          <Kpi rotulo="Paradas" valor={carga.qtd_paradas} />
          <Kpi rotulo="Pedidos" valor={carga.qtd_pedidos} />
          <Kpi rotulo="Volumes" valor={carga.volumes} />
        </div>
        <VolumesChips volumes={carga.volumes_por_categoria} />

        {carga.estado === "conferida" || editavel ? (
          erroCatalogos ? (
            <ErroOdoo titulo="Cadastros de motorista/veículo indisponíveis" mensagem={erroCatalogos} />
          ) : catalogos ? (
            <div className="grid gap-2 sm:grid-cols-2 max-w-2xl">
              <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                Motorista (exigido para liberar)
                <select value={motorista} onChange={(e) => setMotorista(e.target.value)} className={inputClass} style={inputStyle}>
                  <option value="">—</option>
                  {catalogos.motoristas.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                Veículo (exigido para liberar)
                <select value={veiculo} onChange={(e) => setVeiculo(e.target.value)} className={inputClass} style={inputStyle}>
                  <option value="">—</option>
                  {catalogos.veiculos.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.nome}
                      {v.placa ? ` · ${v.placa}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              {carga.estado === "liberada" ? (
                <button
                  type="button"
                  disabled={pending || (!motorista && !veiculo)}
                  className={botaoClass}
                  style={botaoPrimarioStyle}
                  onClick={() => run(() => editarCargaAction(carga.carga_id, "motorista", `${motorista},${veiculo}`), "Motorista/veículo trocado.")}
                >
                  Trocar motorista/veículo
                </button>
              ) : null}
            </div>
          ) : null
        ) : null}
      </div>

      {notas ? (
        <div className="cartao p-4 flex flex-col gap-2" style={{ border: "2px solid var(--brand-orange)" }}>
          <h3 className="font-bold">Notas da saída em rota</h3>
          {notas.map((n, i) => (
            <div key={i} className="text-sm flex gap-2 flex-wrap items-center">
              <b>{n.pedido}</b>
              {n.nf5117 ? <Chip forte>5117 nº {n.nf5117}</Chip> : null}
              {n.ok === false || n.erro ? <Chip cor="var(--status-critical)">erro: {n.erro || n.xml_erro}</Chip> : null}
              {n.xml_erro && n.ok !== false ? <Chip cor="var(--status-serious)">XML: {n.xml_erro}</Chip> : null}
              {n.aviso ? <Chip>{n.aviso}</Chip> : null}
              {n.parcial ? <Chip cor="var(--status-warning)">parcial</Chip> : null}
            </div>
          ))}
        </div>
      ) : null}

      {danfes ? (
        <div className="cartao p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-bold">DANFEs da carga</h3>
            {danfes.filter((d) => d.tem_pdf || d.estado === "protheus").length > 1 ? (
              <button
                type="button"
                className={botaoClass}
                style={botaoStyle}
                onClick={() => window.open(`/assistencia/logistica/pdf/danfes/${carga.carga_id}`, "_blank")}
              >
                🖨 Imprimir todas ({danfes.filter((d) => d.tem_pdf || d.estado === "protheus").length}) num PDF só
              </button>
            ) : null}
          </div>
          {danfes.length === 0 ? <p className="text-sm">Sem pedidos nesta carga.</p> : null}
          {danfes.map((d, i) => d.tipo ? (
            <div key={`x${i}`} className="flex items-center justify-between gap-2 text-sm py-1" style={{ borderBottom: "1px solid var(--border)" }}>
              <span>
                <b>{d.tipo === "5152" ? "Transferência 5152" : "Nota do cliente 5922"}</b> · {d.cliente}{d.pedido ? ` · ${d.pedido}` : ""} · {d.nf5117}{d.estado === "protheus" ? " (sistema antigo)" : ""}
              </span>
              {d.chave ? (
                <a href={`/assistencia/logistica/pdf/nota/${d.chave}`} target="_blank" rel="noopener noreferrer" className={botaoClass} style={botaoStyle}>
                  Imprimir
                </a>
              ) : null}
            </div>
          ) : (
            <div key={d.pedido_id} className="flex items-center justify-between gap-2 text-sm py-1" style={{ borderBottom: "1px solid var(--border)" }}>
              <span>
                <b>{d.cliente}</b> · {d.pedido} · 5117 {d.nf5117 || "—"}{d.estado === "sem nota" ? "" : ` · ${d.estado}`}
              </span>
              {d.tem_pdf || d.estado === "protheus" ? (
                <a href={`/assistencia/logistica/pdf/danfe/${d.pedido_id}?doc=5117`} target="_blank" rel="noopener noreferrer" className={botaoClass} style={botaoStyle}>
                  Imprimir
                </a>
              ) : (
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {d.estado === "protheus" ? "nota do Protheus" : "a 5117 sai no Sair em rota"}
                </span>
              )}
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="cartao p-4 flex flex-col gap-2 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-bold">Rota · ordem de entrega (carrega ao contrário)</h3>
            {ordemMudou ? (
              <button type="button" disabled={pending} onClick={salvarOrdem} className={botaoClass} style={botaoPrimarioStyle}>
                Salvar ordem
              </button>
            ) : null}
          </div>
          {ordem.length === 0 ? <p className="text-sm">Sem paradas.</p> : null}
          {ordem.map((p, i) => (
            <div key={p.parada_id} className="flex gap-3 py-2 flex-wrap" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="flex-1 min-w-[220px]">
                <button type="button" onClick={() => alternarParada(p)} className="text-left font-bold underline-offset-2 hover:underline" title="Ver os itens desta entrega">
                  {abertas.includes(p.parada_id) ? "▾" : "▸"} {i + 1}. {p.cliente}
                </button>
                {Array.from(new Set(p.pickings.map((pk) => pk.vendedor).filter(Boolean))).length ? (
                  <div className="text-xs" style={{ color: "var(--text-secondary)" }}>Vend.: {Array.from(new Set(p.pickings.map((pk) => pk.vendedor).filter(Boolean))).join(", ")}</div>
                ) : null}
                {p.resultado ? (
                  <span className="ml-2">
                    <Chip cor={COR_RESULTADO[p.resultado]}>{RESULTADO_LABELS[p.resultado] ?? p.resultado}</Chip>
                  </span>
                ) : null}
                <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {p.endereco}
                  {p.telefone ? ` · ${p.telefone}` : ""}
                </div>
                {/* 27/10 (CD, Expresso 28/10): restrição de horário/observação da loja e data programada de cada pedido da parada */}
                {Array.from(new Set(p.pickings.map((pk) => [pk.obs ? `📝 ${pk.obs}` : "", pk.data_programada ? `📅 programada ${pk.data_programada.split("-").reverse().join("/")}` : ""].filter(Boolean).join(" · ")).filter(Boolean))).map((t, k) => (
                  <div key={k} className="text-sm mt-1 px-2 py-1 rounded-md inline-block" style={{ background: "#fff3c4", color: "#5a4300", fontWeight: 600 }}>
                    {t}
                  </div>
                ))}
                {abertas.includes(p.parada_id) ? (
                  <div className="mt-1 mb-1 rounded-lg border p-2 text-sm" style={{ borderColor: "var(--border)" }}>
                    {p.pickings.map((pk) => (
                      <div key={pk.picking_id}>
                        <div className="text-xs" style={{ color: "var(--text-secondary)" }}>{pk.nome}{pk.pedido ? ` · ${pk.pedido}` : ""}</div>
                        {(pk.itens ?? []).length ? (pk.itens ?? []).map((it, j) => {
                          const est = estoqueItens[pk.picking_id]?.[it.codigo];
                          return (
                            <div key={j} className="flex gap-2">
                              <b>{it.qtd}×</b> <span>{it.codigo}</span> <span className="flex-1">{it.nome}</span>
                              {est === undefined ? null : est ? <span className="text-xs" style={{ color: "var(--status-ok, #1B7E3B)" }}>com estoque</span> : <span className="text-xs" style={{ color: "var(--status-critical)" }}>sem estoque</span>}
                            </div>
                          );
                        }) : <div className="text-xs">Sem itens listados.</div>}
                      </div>
                    ))}
                    <div className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>Itens que foram para pendência saem desta carga e aparecem na Expedição › Pendências.</div>
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-1 mt-1">
                  {p.pickings.map((pk) => (
                    <span key={pk.picking_id} className="inline-flex items-center gap-1">
                      <Chip>
                        {pk.nome}
                        {pk.pedido ? ` · ${pk.pedido}` : ""} ({pk.estado})
                      </Chip>
                      <select
                        value=""
                        onChange={(ev) => {
                          const a = ev.target.value as AlvoEntrega["acao"];
                          if (a) setAlvo({ pickingId: pk.picking_id, nome: pk.nome, cliente: p.cliente, acao: a, cargaId: carga.carga_id });
                        }}
                        className="rounded border px-1 py-0.5 text-xs"
                        style={inputStyle}
                        aria-label={`Ações de ${pk.nome}`}
                      >
                        <option value="">⋯</option>
                        <option value="historico">Histórico</option>
                        <option value="anotar">Anotação</option>
                        {editavel ? <option value="mover_carga">Transferir para outra carga</option> : null}
                        {editavel ? <option value="remover_da_carga">Remover da carga</option> : null}
                        {editavel ? <option value="pendencia">Enviar para pendência</option> : null}
                        {pk.estado === "done" ? <option value="estornar">Estornar entrega</option> : null}
                      </select>
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-start gap-1">
                {editavel ? (
                  <>
                    <button
                      type="button"
                      aria-label="Subir"
                      disabled={i === 0}
                      onClick={() => {
                        setOrdem(moverItem(ordem, i, -1));
                        setOrdemMudou(true);
                      }}
                      className={botaoClass}
                      style={botaoStyle}
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      aria-label="Descer"
                      disabled={i === ordem.length - 1}
                      onClick={() => {
                        setOrdem(moverItem(ordem, i, 1));
                        setOrdemMudou(true);
                      }}
                      className={botaoClass}
                      style={botaoStyle}
                    >
                      ▼
                    </button>
                  </>
                ) : null}
                {carga.estado === "em_rota" && !p.resultado ? (
                  <>
                    <button type="button" disabled={pending} onClick={() => baixaManual(p)} className={botaoClass} style={botaoPrimarioStyle}>
                      Baixar entrega
                    </button>
                    <button type="button" disabled={pending} onClick={() => naoSaiu(p)} className={botaoClass} style={botaoStyle}>
                      Não saiu · voltar à fila
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        <div className="cartao p-4 flex flex-col gap-2 min-w-0">
          <h3 className="font-bold">Histórico da carga</h3>
          <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Criada {formatarDataHoraOdoo(carga.criada_em)} · liberada {formatarDataHoraOdoo(carga.liberada_em)} · saiu {formatarDataHoraOdoo(carga.saiu_em)} · fim{" "}
            {formatarDataHoraOdoo(carga.fim_rota_em)}
          </div>
          <ol className="flex flex-col gap-1.5">
            {carga.eventos.length === 0 ? <li className="text-sm">Sem eventos ainda.</li> : null}
            {carga.eventos.map((e) => (
              <li key={e.id} className="text-sm pl-3" style={{ borderLeft: "2px solid var(--brand-green)" }}>
                <b>{e.tipo}</b>{" "}
                <span style={{ color: "var(--text-secondary)" }}>
                  {formatarDataHoraOdoo(e.em)} · {e.origem}
                  {e.motorista ? ` · ${e.motorista}` : ""}
                  {e.picking ? ` · ${e.picking}` : ""}
                  {e.motivo ? ` · ${e.motivo}` : ""}
                  {typeof e.lat === "number" && typeof e.lng === "number" ? (
                    <>
                      {" · "}
                      <a href={`https://www.google.com/maps?q=${e.lat},${e.lng}`} target="_blank" rel="noopener noreferrer" className="underline">
                        mapa
                      </a>
                    </>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <AcaoEntregaDialog alvo={alvo} empresas={empresas} cargas={cargasAbertas} onFechar={() => setAlvo(null)} />
    </div>
  );
}
