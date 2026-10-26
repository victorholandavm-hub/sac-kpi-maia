"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  acaoCargaAction,
  baixarEntregaManualAction,
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

export function CargaDetalheView({
  carga,
  catalogos,
  erroCatalogos,
  empresas,
}: {
  carga: CargaDetalhe;
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
    run(
      () => acaoCargaAction(carga.carga_id, "sair", parciais ? { parciais } : {}),
      (r) => `Carga ${r.romaneio}: ${ESTADO_CARGA_LABELS[r.estado] ?? r.estado}.${parciais ? " O que não foi carregado voltou para a Expedição." : ""}`,
      (r) => { setConferindo(false); if (r.notas?.length) setNotas(r.notas); },
    );
  }
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
          <ConferenciaCarregamento carga={carga} pending={pending} onConfirmar={sair} onCancelar={() => setConferindo(false)} />
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
            {danfes.filter((d) => d.tem_pdf).length > 1 ? (
              <button
                type="button"
                className={botaoClass}
                style={botaoStyle}
                onClick={() => danfes.filter((d) => d.tem_pdf).forEach((d) => window.open(`/assistencia/logistica/pdf/danfe/${d.pedido_id}?doc=5117`, "_blank"))}
              >
                Abrir todas ({danfes.filter((d) => d.tem_pdf).length})
              </button>
            ) : null}
          </div>
          {danfes.length === 0 ? <p className="text-sm">Sem pedidos nesta carga.</p> : null}
          {danfes.map((d) => (
            <div key={d.pedido_id} className="flex items-center justify-between gap-2 text-sm py-1" style={{ borderBottom: "1px solid var(--border)" }}>
              <span>
                <b>{d.cliente}</b> · {d.pedido} · 5117 {d.nf5117 || "—"} · {d.estado}
              </span>
              {d.tem_pdf ? (
                <a href={`/assistencia/logistica/pdf/danfe/${d.pedido_id}?doc=5117`} target="_blank" rel="noopener noreferrer" className={botaoClass} style={botaoStyle}>
                  Imprimir
                </a>
              ) : (
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {d.estado === "protheus" ? "nota do Protheus" : "sem nota"}
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
                <b>
                  {i + 1}. {p.cliente}
                </b>
                {p.resultado ? (
                  <span className="ml-2">
                    <Chip cor={COR_RESULTADO[p.resultado]}>{RESULTADO_LABELS[p.resultado] ?? p.resultado}</Chip>
                  </span>
                ) : null}
                <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {p.endereco}
                  {p.telefone ? ` · ${p.telefone}` : ""}
                </div>
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
                  <button type="button" disabled={pending} onClick={() => baixaManual(p)} className={botaoClass} style={botaoPrimarioStyle}>
                    Baixar entrega
                  </button>
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

      <AcaoEntregaDialog alvo={alvo} empresas={empresas} onFechar={() => setAlvo(null)} />
    </div>
  );
}
