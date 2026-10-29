"use client";

import { useEffect, useState } from "react";
import { acaoEntregaAction, estornarEntregaAction, historicoEntregaAction, itensEntregaAction, retiradaNoCdAction, separarPendenciaAction, transferirItensAction } from "@/app/assistencia/logistica/logistica-actions";
import { ACAO_ENTREGA_LABELS, ESTADO_CARGA_LABELS, formatarDataHoraOdoo, formatarDiaIso, type AcaoEntrega, type CargaOdoo, type EmpresaOdoo, type HistoricoEntrega } from "@/lib/odoo/logisticaTipos";
import type { ItemEntregaOdoo } from "@/lib/odoo/logistica";
import { useAcaoOdoo } from "./useAcaoOdoo";
import { botaoClass, botaoPrimarioStyle, botaoStyle, inputClass, inputStyle } from "./ui";

// notaEntrega: a mesma retirada_cd vista pelo SAC ("Nota de entrega": emite a
// 5117 e dá baixa como entregue) -- Victor 29/10/2026.
export type AlvoEntrega = { pickingId: number; nome: string; cliente: string; acao: AcaoEntrega; cargaId?: number; companyId?: number; notaEntrega?: boolean };

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
  const [itens, setItens] = useState<ItemEntregaOdoo[] | null>(null);
  const [marcados, setMarcados] = useState<string[]>([]);
  const [resto, setResto] = useState<"segue" | "espera">("segue");
  const [erroItens, setErroItens] = useState<string | null>(null);

  useEffect(() => {
    if (alvo.acao !== "pendencia" && alvo.acao !== "transferir_filial") return;
    let vivo = true;
    // 26/10 (Francisca/Débora): sem tratamento de erro/tempo, o diálogo ficava esperando para sempre e as opções não apareciam
    const t = setTimeout(() => {
      if (!vivo) return;
      setItens((cur) => (cur === null ? [] : cur));
      setErroItens("Os itens demoraram para carregar. Você ainda pode mandar a entrega inteira para pendência, ou fechar e abrir de novo.");
    }, 25_000);
    itensEntregaAction(alvo.pickingId)
      .then((r) => {
        if (!vivo) return;
        clearTimeout(t);
        const l = r.ok && Array.isArray(r.dados) ? r.dados : [];
        if (!r.ok) setErroItens(`Não consegui carregar os itens (${r.erro}). Você ainda pode mandar a entrega inteira para pendência.`);
        setItens(l);
        setMarcados(alvo.acao === "transferir_filial" ? l.map((i) => i.codigo) : l.filter((i) => !i.tem_estoque).map((i) => i.codigo));
      })
      .catch(() => {
        if (!vivo) return;
        clearTimeout(t);
        setItens([]);
        setErroItens("Não consegui carregar os itens. Você ainda pode mandar a entrega inteira para pendência.");
      });
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [alvo]);

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

  const titulo = `${alvo.notaEntrega ? "Nota de entrega" : ACAO_ENTREGA_LABELS[alvo.acao]} · ${alvo.nome}`;

  function confirmar() {
    if (!alvo) return;
    if (alvo.acao === "estornar") {
      run(() => estornarEntregaAction(alvo.pickingId), (d) => `Estornada: retorno ${d.retorno}, nova saída ${d.nova}.`, onFechar);
      return;
    }
    if (alvo.acao === "historico") return;
    if (alvo.acao === "retirada_cd") {
      const pergunta = alvo.notaEntrega
        ? `Emitir a nota de entrega (5117) de ${alvo.nome} e dar baixa como entregue para ${valor}?`
        : `Confirmar que ${valor || "o fretista"} retirou ${alvo.nome} no CD? Sai a nota de saída (5117) agora.`;
      if (!window.confirm(pergunta)) return;
      run(
        () => retiradaNoCdAction(alvo.companyId ?? 13, alvo.pickingId, valor),
        (d) =>
          alvo.notaEntrega
            ? `Nota de entrega emitida e baixa dada (carga ${d.romaneio}). ${d.notas.join(" · ")} A DANFE sai na Consulta de pedido.`
            : `Retirada registrada (carga ${d.romaneio}). ${d.notas.join(" · ") || "Nota emitida."} Imprima a DANFE em Cargas › ${d.romaneio}.`,
        onFechar,
      );
      return;
    }
    if (alvo.acao === "pendencia" && itens && itens.length > 1 && resto === "segue" && marcados.length > 0 && marcados.length < itens.length) {
      run(() => separarPendenciaAction(alvo.pickingId, valor, marcados, alvo.cargaId), (d) => `Pendência separada em ${d.pendencia} (${d.itens}); o resto segue.`, onFechar);
      return;
    }
    if (alvo.acao === "transferir_filial" && itens && itens.length > 1 && marcados.length > 0 && marcados.length < itens.length) {
      run(() => transferirItensAction(alvo.pickingId, Number(valor), marcados), `Só ${marcados.join(", ")} mudou de filial; o resto segue como estava.`, onFechar);
      return;
    }
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

        {alvo.acao === "retirada_cd" && alvo.notaEntrega ? (
          <>
            <p className="text-sm">
              Emite a <b>nota de entrega (5117)</b> deste pedido e dá <b>baixa como entregue</b>. Escreva <b>quem recebeu ou retirou</b> (nome,
              documento; se for fretista, a placa) — fica no histórico do pedido. Leva até 1 minuto.
            </p>
            <textarea autoFocus rows={2} value={valor} onChange={(e) => setValor(e.target.value)} placeholder="ex.: Maria da Silva, CPF 000.000.000-00" className={inputClass} style={inputStyle} />
          </>
        ) : alvo.acao === "retirada_cd" ? (
          <>
            <p className="text-sm">
              O cliente mandou alguém buscar no CD. Escreva <b>quem retirou</b> (nome, documento e placa). O sistema emite a nota de saída (5117), dá
              baixa como entregue e guarda o nome no histórico do pedido. Leva até 1 minuto.
            </p>
            <textarea autoFocus rows={2} value={valor} onChange={(e) => setValor(e.target.value)} placeholder="ex.: José da Silva, CPF 000.000.000-00, fretista, placa ABC1D23" className={inputClass} style={inputStyle} />
          </>
        ) : null}
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
        {alvo.acao === "pendencia" && itens === null ? <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Carregando os itens da entrega…</p> : null}
        {alvo.acao === "pendencia" && erroItens ? <p className="text-sm" style={{ color: "var(--status-serious)" }}>{erroItens}</p> : null}
        {alvo.acao === "pendencia" && itens && itens.length === 1 ? <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Esta entrega tem só 1 item: vai inteira para a pendência.</p> : null}
        {alvo.acao === "pendencia" && itens && itens.length > 1 ? (
          <div className="flex flex-col gap-1 text-sm">
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Marque o que vai para a pendência:</p>
            {itens.map((i) => (
              <label key={i.move_id} className="flex items-start gap-2">
                <input type="checkbox" className="w-5 h-5 mt-0.5" checked={marcados.includes(i.codigo)}
                  onChange={() => setMarcados((m) => (m.includes(i.codigo) ? m.filter((x) => x !== i.codigo) : [...m, i.codigo]))} />
                <span>{i.qtd}× {i.codigo} {i.nome}{i.tem_estoque ? "" : " · sem estoque"}</span>
              </label>
            ))}
            <p className="text-xs mt-2" style={{ color: "var(--text-secondary)" }}>Os outros itens:</p>
            <label className="flex items-center gap-2"><input type="radio" checked={resto === "segue"} onChange={() => setResto("segue")} /> seguem para a rota agora</label>
            <label className="flex items-center gap-2"><input type="radio" checked={resto === "espera"} onChange={() => setResto("espera")} /> esperam junto a pendência</label>
          </div>
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
        {alvo.acao === "transferir_filial" && itens && itens.length > 1 ? (
          <div className="flex flex-col gap-1 text-sm">
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Quais itens vão para essa filial? (desmarque o que fica como está)</p>
            {itens.map((i) => (
              <label key={i.move_id} className="flex items-start gap-2">
                <input type="checkbox" className="w-5 h-5 mt-0.5" checked={marcados.includes(i.codigo)}
                  onChange={() => setMarcados((m) => (m.includes(i.codigo) ? m.filter((x) => x !== i.codigo) : [...m, i.codigo]))} />
                <span>{i.qtd}× {i.codigo} {i.nome}</span>
              </label>
            ))}
          </div>
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
