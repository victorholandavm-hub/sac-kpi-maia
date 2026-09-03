"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateStatus, addNote, createExchangeChild } from "@/app/assistencia/actions";
import { useQuickAction } from "./useQuickAction";
import { CAUSA_RAIZ_OPTIONS, CAUSA_RAIZ_LABELS } from "@/lib/assistenciaLabels";

// Ações específicas de troca/entrega/envio de peça e recolhimento
// (DELIVERY_REQUEST_TYPES) -- separado de RequestActions.tsx de propósito
// (pedido do Victor 20/08/2026: "dentro das entregas... ajuste esses
// status"). RequestActions usa o vocabulário de visita de montagem (Em
// contato, Em andamento) via NEXT_STATUSES -- não faz sentido pra entrega,
// mesma razão que já motivou o badge simplificado (ver DeliveryStatusBadge,
// pedido do Victor 19/08/2026: "só programado e concluído"). Aqui só entram
// os 3 destinos que realmente existem pra entrega: Concluída, Cancelada, e
// Remarcar (usado de verdade -- ver driverReportIssue em driver-actions.ts,
// "Não consegui concluir" do motorista grava esse mesmo status; setSchedule
// já limpa "remarcar" sozinho assim que uma data nova é definida, então não
// precisa de reverter isso aqui).
//
// "Pedir nova troca" continua igual à versão de RequestActions.tsx --
// única peça de troca_produto que não tem equivalente simplificado, ver
// canRequestNewExchange abaixo.
export function DeliveryRequestActions({
  requestId,
  requestType,
  status,
  hasChildExchange = false,
}: {
  requestId: string;
  requestType: string;
  status: string;
  hasChildExchange?: boolean;
}) {
  const router = useRouter();
  const { pending, run, showToast } = useQuickAction();
  const [note, setNote] = useState("");
  const [askingRemarcarReason, setAskingRemarcarReason] = useState(false);
  const [remarcarReason, setRemarcarReason] = useState("");

  const [askingNovaTroca, setAskingNovaTroca] = useState(false);
  const [sameProduct, setSameProduct] = useState<boolean | null>(null);
  const [novaTrocaReason, setNovaTrocaReason] = useState("");
  const [novaTrocaCausaRaiz, setNovaTrocaCausaRaiz] = useState("");
  const [novaTrocaCarga, setNovaTrocaCarga] = useState("");
  const [novaTrocaConferente, setNovaTrocaConferente] = useState("");
  const [novaTrocaDriverName, setNovaTrocaDriverName] = useState("");
  const [novaTrocaCausaRaizDetalhe, setNovaTrocaCausaRaizDetalhe] = useState("");

  const isFinal = status === "concluida" || status === "cancelada";
  // Produto trocado pode voltar com defeito de novo -- em vez de reabrir o
  // mesmo chamado (perdia a 1ª troca), cria um chamado novo ligado a esse
  // (ver createExchangeChild no servidor). Ao confirmar, navega pro chamado
  // novo -- é ele que passa a ser o "atual" da conversa com o cliente.
  const canRequestNewExchange = requestType === "troca_produto" && status === "concluida" && !hasChildExchange;

  function resetNovaTroca() {
    setAskingNovaTroca(false);
    setSameProduct(null);
    setNovaTrocaReason("");
    setNovaTrocaCausaRaiz("");
    setNovaTrocaCarga("");
    setNovaTrocaConferente("");
    setNovaTrocaDriverName("");
    setNovaTrocaCausaRaizDetalhe("");
  }

  function confirmNovaTroca() {
    if (!novaTrocaReason.trim()) {
      showToast("Informe o que aconteceu.", "error");
      return;
    }
    if (!novaTrocaCausaRaiz) {
      showToast("Selecione quem errou.", "error");
      return;
    }
    // "Outro" precisa dizer exatamente o que houve -- pedido do Victor
    // 21/08/2026.
    if (novaTrocaCausaRaiz === "outro" && !novaTrocaCausaRaizDetalhe.trim()) {
      showToast("Descreva a causa raiz.", "error");
      return;
    }
    if (sameProduct === null) return;
    run(async () => {
      const child = await createExchangeChild(requestId, {
        reason: novaTrocaReason,
        sameProduct,
        causaRaiz: novaTrocaCausaRaiz,
        causaCarga: novaTrocaCarga,
        causaConferente: novaTrocaConferente,
        driverNameForError: novaTrocaDriverName,
        causaRaizDetalhe: novaTrocaCausaRaizDetalhe,
      });
      resetNovaTroca();
      router.push(`/assistencia/${child.id}`);
    }, "Nova troca criada.");
  }

  function confirmRemarcar() {
    if (!remarcarReason.trim()) {
      showToast("Informe o motivo da remarcação.", "error");
      return;
    }
    run(async () => {
      await updateStatus(requestId, "remarcar", remarcarReason);
      setRemarcarReason("");
      setAskingRemarcarReason(false);
    }, "Marcado pra remarcar.");
  }

  return (
    <>
    <div className="rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-sm p-4 flex flex-col gap-3">
      {/* Ações rápidas -- Guia de Componentes Maia (Design System,
          01/09/2026): "grupo vertical de botões bem definidos" no lugar
          da fileira de botões cinzas/coloridos soltos, cada um outline
          colorido por semântica (verde/âmbar/vermelho). Sem "Assumir pra
          mim" aqui -- pedido do Victor 01/09/2026: "nas entregas, o
          assumir para mim nao faz sentido, pois aquela notificação ja
          fica vinculada a quem a criou no sistema" (diferente de visita
          de montagem, ver RequestActions.tsx, que continua com claim --
          lá faz sentido, um montador pode pegar um chamado de outro). */}
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Ações rápidas</h3>

      <div className="flex flex-col gap-2">
        {!isFinal ? (
          <>
            <button
              disabled={pending}
              onClick={() => run(() => updateStatus(requestId, "concluida"), "Marcado como concluída.")}
              className="text-sm rounded-lg px-3.5 py-2.5 font-medium border-2 transition-colors duration-150 disabled:opacity-60"
              style={{ borderColor: "var(--status-good)", color: "var(--status-good)" }}
            >
              Marcar como Concluída
            </button>
            {status !== "remarcar" ? (
              <button
                disabled={pending}
                onClick={() => setAskingRemarcarReason(true)}
                className="text-sm rounded-lg px-3.5 py-2.5 font-medium border-2 transition-colors duration-150 disabled:opacity-60"
                style={{ borderColor: "var(--status-warning)", color: "#8a5a00" }}
              >
                Remarcar
              </button>
            ) : null}
            <button
              disabled={pending}
              onClick={() => run(() => updateStatus(requestId, "cancelada"), "Marcado como cancelada.")}
              className="text-sm rounded-lg px-3.5 py-2.5 font-medium border-2 transition-colors duration-150 disabled:opacity-60"
              style={{ borderColor: "var(--status-critical)", color: "var(--status-critical)" }}
            >
              Cancelar
            </button>
          </>
        ) : !canRequestNewExchange ? (
          <button
            disabled={pending}
            onClick={() => run(() => updateStatus(requestId, "aberta"), "Status revertido para aberta.")}
            className="text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-150 self-start disabled:opacity-60"
          >
            ↩ Reverter pra Aberta (marquei errado)
          </button>
        ) : null}
      </div>

      {askingRemarcarReason ? (
        <div className="flex flex-col gap-2 rounded-lg border-2 p-3" style={{ borderColor: "var(--status-warning)" }}>
          <span className="text-sm" style={{ color: "#1F2937" }}>
            Qual o motivo da remarcação?
          </span>
          <textarea
            value={remarcarReason}
            onChange={(e) => setRemarcarReason(e.target.value)}
            rows={2}
            placeholder="Ex: cliente ausente, endereço errado, precisa de nova data…"
            className="rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 hover:border-gray-300 dark:hover:border-gray-500 focus:border-gray-300 dark:focus:border-gray-500 focus:outline-none transition-colors duration-150"
            style={{ borderColor: "#E5E7EB" }}
            autoFocus
          />
          <div className="flex items-center gap-2">
            <button
              disabled={pending || !remarcarReason.trim()}
              onClick={confirmRemarcar}
              className="text-sm rounded px-3 py-2 disabled:opacity-60"
              style={{ background: "var(--status-warning)", color: "#fff" }}
            >
              Confirmar remarcação
            </button>
            <button
              onClick={() => {
                setAskingRemarcarReason(false);
                setRemarcarReason("");
              }}
              className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors duration-150"
            >
              cancelar
            </button>
          </div>
        </div>
      ) : null}

      {canRequestNewExchange && !askingNovaTroca ? (
        <button
          disabled={pending}
          onClick={() => setAskingNovaTroca(true)}
          className="text-sm rounded px-3 py-2 self-start disabled:opacity-60"
          style={{ background: "var(--status-warning)", color: "#fff" }}
        >
          🔁 Produto trocado veio com problema — pedir nova troca
        </button>
      ) : null}

      {askingNovaTroca && sameProduct === null ? (
        <div className="flex flex-col gap-2 rounded-lg border-2 p-3" style={{ borderColor: "var(--status-warning)" }}>
          <span className="text-sm" style={{ color: "#1F2937" }}>
            A nova troca é pelo mesmo produto ou o cliente quer outro?
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setSameProduct(true)}
              className="text-sm rounded px-3 py-2"
              style={{ background: "var(--status-warning)", color: "#fff" }}
            >
              Mesmo produto
            </button>
            <button
              onClick={() => setSameProduct(false)}
              className="text-sm rounded px-3 py-2 border"
              style={{ borderColor: "var(--status-warning)", color: "#1F2937" }}
            >
              Outro produto
            </button>
            <button onClick={resetNovaTroca} className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors duration-150">
              cancelar
            </button>
          </div>
        </div>
      ) : null}

      {askingNovaTroca && sameProduct !== null ? (
        <div className="flex flex-col gap-2 rounded-lg border-2 p-3" style={{ borderColor: "var(--status-warning)" }}>
          <span className="text-sm" style={{ color: "#1F2937" }}>
            {sameProduct ? "Mesmo produto" : "Outro produto"} — o que aconteceu com o produto trocado?
          </span>
          <textarea
            value={novaTrocaReason}
            onChange={(e) => setNovaTrocaReason(e.target.value)}
            rows={2}
            placeholder="Ex: veio com a mesma avaria, cliente decidiu trocar de modelo…"
            className="rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 hover:border-gray-300 dark:hover:border-gray-500 focus:border-gray-300 dark:focus:border-gray-500 focus:outline-none transition-colors duration-150"
            style={{ borderColor: "#E5E7EB" }}
            autoFocus
          />
          <select
            value={novaTrocaCausaRaiz}
            onChange={(e) => setNovaTrocaCausaRaiz(e.target.value)}
            className="rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 hover:border-gray-300 dark:hover:border-gray-500 focus:border-gray-300 dark:focus:border-gray-500 focus:outline-none transition-colors duration-150"
            style={{ borderColor: "#E5E7EB" }}
          >
            <option value="" disabled>
              Quem errou (controle interno) *
            </option>
            {CAUSA_RAIZ_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {CAUSA_RAIZ_LABELS[c]}
              </option>
            ))}
          </select>
          {novaTrocaCausaRaiz === "erro_conferencia" || novaTrocaCausaRaiz === "sujeira_conferencia" ? (
            <div className="grid sm:grid-cols-2 gap-2">
              <input
                value={novaTrocaCarga}
                onChange={(e) => setNovaTrocaCarga(e.target.value)}
                placeholder="Carga *"
                className="rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 hover:border-gray-300 dark:hover:border-gray-500 focus:border-gray-300 dark:focus:border-gray-500 focus:outline-none transition-colors duration-150"
                style={{ borderColor: "#E5E7EB" }}
              />
              <input
                value={novaTrocaConferente}
                onChange={(e) => setNovaTrocaConferente(e.target.value)}
                placeholder="Conferente *"
                className="rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 hover:border-gray-300 dark:hover:border-gray-500 focus:border-gray-300 dark:focus:border-gray-500 focus:outline-none transition-colors duration-150"
                style={{ borderColor: "#E5E7EB" }}
              />
            </div>
          ) : null}
          {novaTrocaCausaRaiz === "erro_motorista" ? (
            <div className="grid sm:grid-cols-2 gap-2">
              <input
                value={novaTrocaCarga}
                onChange={(e) => setNovaTrocaCarga(e.target.value)}
                placeholder="Carga *"
                className="rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 hover:border-gray-300 dark:hover:border-gray-500 focus:border-gray-300 dark:focus:border-gray-500 focus:outline-none transition-colors duration-150"
                style={{ borderColor: "#E5E7EB" }}
              />
              <input
                value={novaTrocaDriverName}
                onChange={(e) => setNovaTrocaDriverName(e.target.value)}
                placeholder="Motorista que entregou (erro) *"
                className="rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 hover:border-gray-300 dark:hover:border-gray-500 focus:border-gray-300 dark:focus:border-gray-500 focus:outline-none transition-colors duration-150"
                style={{ borderColor: "#E5E7EB" }}
              />
            </div>
          ) : null}
          {novaTrocaCausaRaiz === "outro" ? (
            <textarea
              value={novaTrocaCausaRaizDetalhe}
              onChange={(e) => setNovaTrocaCausaRaizDetalhe(e.target.value)}
              rows={2}
              placeholder="O que houve, exatamente? *"
              className="rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 hover:border-gray-300 dark:hover:border-gray-500 focus:border-gray-300 dark:focus:border-gray-500 focus:outline-none transition-colors duration-150"
              style={{ borderColor: "#E5E7EB" }}
            />
          ) : null}
          <div className="flex items-center gap-2">
            <button
              disabled={
                pending ||
                !novaTrocaReason.trim() ||
                !novaTrocaCausaRaiz ||
                (novaTrocaCausaRaiz === "outro" && !novaTrocaCausaRaizDetalhe.trim())
              }
              onClick={confirmNovaTroca}
              className="text-sm rounded px-3 py-2 disabled:opacity-60"
              style={{ background: "var(--status-warning)", color: "#fff" }}
            >
              Confirmar nova troca
            </button>
            <button onClick={resetNovaTroca} className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors duration-150">
              cancelar
            </button>
          </div>
        </div>
      ) : null}

    </div>

    {/* Notas rápidas -- bloco próprio, separado das ações de status (Guia
        de Componentes Maia): "campo de texto compacto para adicionar
        observações". */}
    <div className="rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-sm p-4 flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Notas rápidas</h3>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="Adicionar observação…"
        className="rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 hover:border-gray-300 dark:hover:border-gray-500 focus:border-gray-300 dark:focus:border-gray-500 focus:outline-none transition-colors duration-150"
      />
      <button
        disabled={pending || !note.trim()}
        onClick={() =>
          run(async () => {
            await addNote(requestId, note);
            setNote("");
          }, "Nota adicionada.")
        }
        className="text-sm rounded-lg px-3.5 py-2 self-start border border-gray-200 dark:border-gray-600 font-medium text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500 hover:text-gray-800 dark:hover:text-gray-100 transition-colors duration-150 disabled:opacity-60"
      >
        Adicionar nota
      </button>
    </div>
    </>
  );
}
