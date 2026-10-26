"use client";

import { useEffect, useState } from "react";
import { acaoEntregaAction, estornarEntregaAction, historicoEntregaAction } from "@/app/assistencia/logistica/logistica-actions";
import { ACAO_ENTREGA_LABELS, ESTADO_CARGA_LABELS, formatarDataHoraOdoo, formatarDiaIso, type AcaoEntrega, type CargaOdoo, type EmpresaOdoo, type HistoricoEntrega } from "@/lib/odoo/logisticaTipos";
import { useAcaoOdoo } from "./useAcaoOdoo";
import { botaoClass, botaoPrimarioStyle, botaoStyle, inputClass, inputStyle } from "./ui";

export type AlvoEntrega = { pickingId: number; nome: string; cliente: string; acao: AcaoEntrega; cargaId?: number };

// Um diálogo só para todos os verbos da entrega (o que o CD faz no
// "Outras ações ▸ Alterar" do Roteirizador). Cada verbo pede o valor certo:
// motivo (pendência), data (programar), filial (transferir), texto
// (anotação), confirmação (fila, remover da carga, estornar) ou só lê
// (histórico).
export function AcaoEntregaDialog({ alvo, empresas, cargas, onFechar }: { alvo: AlvoEntrega | null; empresas: EmpresaOdoo[]; cargas?: CargaOdoo[]; onFechar: () => void }) {
  if (!alvo) return null;
  return <Dialogo key={`${alvo.pickingId}-${alvo.acao}`} alvo={alvo} empresas={empresas} cargas={cargas ?? []} onFechar={onFechar} />;
}

function Dialogo({ alvo, empresas, cargas, onFechar }: { alvo: AlvoEntrega; empresas: EmpresaOdoo[]; cargas: CargaOdoo[]; onFechar: () => void }) {
  const { pending, run } = useAcaoOdoo();
  const [valor, setValor] = useState(() => (alvo.acao === "programar" ? new Date(Date.now() + 86_400_000).toISOString().slice(0, 10) : ""));
  const [hist, setHist] = useState<HistoricoEntrega | null>(null);
  const [erroHist, setErroHist] = useState<string | null>(null);

  useEffect(() => {
    if (alvo.acao !== "historico") return;
    let vivo = true;
    historicoEntregaAction(alvo.pickingId)
      .then((r) => {
        if (!vivo) return;
        if (r.ok) setHist(r.dados);
        else setErroHist(r.erro);
      })
      .catch((e: unknown) => vivo && setErroHist(e instanceof Error ? e.message : "Falha ao ler o histórico."));
    return () => {
      vivo = false;
    };
  }, [alvo]);

  const titulo = `${ACAO_ENTREGA_LABELS[alvo.acao]} · ${alvo.nome}`;

  function confirmar() {
    if (!alvo) return;
    if (alvo.acao === "estornar") {
      run(() => estornarEntregaAction(alvo.pickingId), (d) => `Estornada: retorno ${d.retorno}, nova saída ${d.nova}.`, onFechar);
      return;
    }
    if (alvo.acao === "historico") return;
    const v = alvo.acao === "transferir_filial" || alvo.acao === "mover_carga" ? Number(valor) : alvo.acao === "fila" || alvo.acao === "remover_da_carga" ? null : valor;
    run(() => acaoEntregaAction(alvo.pickingId, alvo.acao as Exclude<AcaoEntrega, "historico" | "estornar">, v, alvo.cargaId), "Feito.", onFechar);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: "rgba(11,11,11,.45)" }} onClick={onFechar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-5 flex flex-col gap-3 max-h-[90vh] overflow-auto"
        style={{ background: "var(--surface-1)", color: "var(--text-primary)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-bold">{titulo}</h3>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {alvo.cliente}
            </p>
          </div>
          <button type="button" onClick={onFechar} className={botaoClass} style={botaoStyle} aria-label="Fechar">
            ✕
          </button>
        </div>

        {alvo.acao === "pendencia" || alvo.acao === "anotar" ? (
          <textarea
            autoFocus
            rows={3}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder={alvo.acao === "pendencia" ? "Motivo (ex.: falta o produto, cliente pediu para esperar)" : "Anotação para esta entrega"}
            className={inputClass}
            style={inputStyle}
          />
        ) : null}
        {alvo.acao === "programar" ? <input type="date" value={valor} onChange={(e) => setValor(e.target.value)} className={inputClass} style={inputStyle} /> : null}
        {alvo.acao === "transferir_filial" ? (
          <select value={valor} onChange={(e) => setValor(e.target.value)} className={inputClass} style={inputStyle}>
            <option value="">Filial que vai entregar…</option>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        ) : null}
        {alvo.acao === "mover_carga" ? (
          <>
            <p className="text-sm">O pedido sai desta carga e entra na carga escolhida (só cargas que ainda não saíram).</p>
            <select value={valor} onChange={(e) => setValor(e.target.value)} className={inputClass} style={inputStyle} aria-label="Carga de destino">
              <option value="">Carga de destino…</option>
              {cargas
                .filter((c) => c.carga_id !== alvo.cargaId)
                .map((c) => (
                  <option key={c.carga_id} value={c.carga_id}>
                    {c.romaneio} · {ESTADO_CARGA_LABELS[c.estado] ?? c.estado}
                    {c.zona ? ` · ${c.zona}` : ""}
                    {c.descricao ? ` · ${c.descricao}` : ""}
                    {c.data_prevista ? ` · ${formatarDiaIso(c.data_prevista)}` : ""}
                    {c.motorista ? ` · ${c.motorista}` : ""} ({c.qtd_pedidos} pedidos)
                  </option>
                ))}
            </select>
            {cargas.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--status-critical)" }}>
                Nenhuma outra carga aberta. Monte a carga nova na Expedição primeiro.
              </p>
            ) : null}
          </>
        ) : null}
        {alvo.acao === "fila" ? <p className="text-sm">A entrega sai da pendência e volta para a fila de expedição.</p> : null}
        {alvo.acao === "remover_da_carga" ? <p className="text-sm">A entrega sai da carga e volta para a fila de expedição.</p> : null}
        {alvo.acao === "estornar" ? (
          <p className="text-sm">
            Só para entrega concluída <b>sem nota de saída</b> (5117/NFC-e): o Odoo devolve ao estoque e cria uma nova saída na fila. Com nota, é
            devolução fiscal (caixa), não logística.
          </p>
        ) : null}

        {alvo.acao === "historico" ? (
          erroHist ? (
            <p className="text-sm" style={{ color: "var(--status-critical)" }}>
              {erroHist}
            </p>
          ) : !hist ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Carregando histórico do Odoo…
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {hist.picking} · {hist.pedido}
                {hist.zae ? ` · Protheus: ${hist.zae}` : ""}
              </p>
              <ol className="flex flex-col gap-1.5">
                {hist.historico.length === 0 ? <li className="text-sm">Sem eventos.</li> : null}
                {hist.historico.map((h, i) => (
                  <li key={i} className="text-sm pl-3" style={{ borderLeft: "2px solid var(--brand-green)" }}>
                    <b>{formatarDataHoraOdoo(h.em)}</b> <span style={{ color: "var(--text-secondary)" }}>{h.quem}</span> — {h.texto}
                  </li>
                ))}
              </ol>
            </div>
          )
        ) : (
          <button type="button" disabled={pending} onClick={confirmar} className={botaoClass} style={botaoPrimarioStyle}>
            {pending ? "Enviando ao Odoo…" : "Confirmar"}
          </button>
        )}
      </div>
    </div>
  );
}
