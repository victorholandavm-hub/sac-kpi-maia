"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { claimRequest, updateStatus, addNote, createExchangeChild } from "@/app/assistencia/actions";
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
  isAssignedToMe,
  hideClaim = false,
  hasChildExchange = false,
}: {
  requestId: string;
  requestType: string;
  status: string;
  isAssignedToMe: boolean;
  hideClaim?: boolean;
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
    if (sameProduct === null) return;
    run(async () => {
      const child = await createExchangeChild(requestId, {
        reason: novaTrocaReason,
        sameProduct,
        causaRaiz: novaTrocaCausaRaiz,
        causaCarga: novaTrocaCarga,
        causaConferente: novaTrocaConferente,
        driverNameForError: novaTrocaDriverName,
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
    <div
      className="flex flex-col gap-3 rounded-lg p-4"
      style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}
    >
      <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
        Ações
      </h3>

      {!hideClaim && !isAssignedToMe ? (
        <button
          disabled={pending}
          onClick={() => run(() => claimRequest(requestId), "Solicitação assumida.")}
          className="text-sm rounded px-3 py-2 self-start disabled:opacity-60"
          style={{ background: "var(--brand-orange)", color: "#fff" }}
        >
          Assumir para mim
        </button>
      ) : null}

      {!isFinal ? (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            disabled={pending}
            onClick={() => run(() => updateStatus(requestId, "concluida"), "Marcado como concluída.")}
            className="text-sm rounded px-3 py-2 font-medium disabled:opacity-60"
            style={{ background: "var(--status-good)", color: "#fff" }}
          >
            Marcar como Concluída
          </button>
          {status !== "remarcar" ? (
            <button
              disabled={pending}
              onClick={() => setAskingRemarcarReason(true)}
              className="text-sm rounded px-3 py-2 disabled:opacity-60"
              style={{ background: "color-mix(in srgb, var(--status-warning) 35%, var(--surface-1))", color: "var(--text-primary)" }}
            >
              Marcar como Remarcar
            </button>
          ) : null}
          <button
            disabled={pending}
            onClick={() => run(() => updateStatus(requestId, "cancelada"), "Marcado como cancelada.")}
            className="text-sm rounded px-3 py-2 disabled:opacity-60"
            style={{ background: "color-mix(in srgb, var(--status-critical) 35%, var(--surface-1))", color: "var(--text-primary)" }}
          >
            Marcar como Cancelada
          </button>
        </div>
      ) : !canRequestNewExchange ? (
        <button
          disabled={pending}
          onClick={() => run(() => updateStatus(requestId, "aberta"), "Status revertido para aberta.")}
          className="text-xs underline self-start disabled:opacity-60"
          style={{ color: "var(--text-secondary)" }}
        >
          ↩ Reverter pra Aberta (marquei errado)
        </button>
      ) : null}

      {askingRemarcarReason ? (
        <div className="flex flex-col gap-2 rounded border p-3" style={{ borderColor: "var(--status-warning)" }}>
          <span className="text-sm" style={{ color: "var(--text-primary)" }}>
            Qual o motivo da remarcação?
          </span>
          <textarea
            value={remarcarReason}
            onChange={(e) => setRemarcarReason(e.target.value)}
            rows={2}
            placeholder="Ex: cliente ausente, endereço errado, precisa de nova data…"
            className="rounded border px-3 py-2 text-sm"
            style={{ borderColor: "var(--border)" }}
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
              className="text-sm underline"
              style={{ color: "var(--text-secondary)" }}
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
        <div className="flex flex-col gap-2 rounded border p-3" style={{ borderColor: "var(--status-warning)" }}>
          <span className="text-sm" style={{ color: "var(--text-primary)" }}>
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
              style={{ borderColor: "var(--status-warning)", color: "var(--text-primary)" }}
            >
              Outro produto
            </button>
            <button onClick={resetNovaTroca} className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
              cancelar
            </button>
          </div>
        </div>
      ) : null}

      {askingNovaTroca && sameProduct !== null ? (
        <div className="flex flex-col gap-2 rounded border p-3" style={{ borderColor: "var(--status-warning)" }}>
          <span className="text-sm" style={{ color: "var(--text-primary)" }}>
            {sameProduct ? "Mesmo produto" : "Outro produto"} — o que aconteceu com o produto trocado?
          </span>
          <textarea
            value={novaTrocaReason}
            onChange={(e) => setNovaTrocaReason(e.target.value)}
            rows={2}
            placeholder="Ex: veio com a mesma avaria, cliente decidiu trocar de modelo…"
            className="rounded border px-3 py-2 text-sm"
            style={{ borderColor: "var(--border)" }}
            autoFocus
          />
          <select
            value={novaTrocaCausaRaiz}
            onChange={(e) => setNovaTrocaCausaRaiz(e.target.value)}
            className="rounded border px-3 py-2 text-sm"
            style={{ borderColor: "var(--border)" }}
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
          {novaTrocaCausaRaiz === "erro_conferencia" ? (
            <div className="grid sm:grid-cols-2 gap-2">
              <input
                value={novaTrocaCarga}
                onChange={(e) => setNovaTrocaCarga(e.target.value)}
                placeholder="Carga *"
                className="rounded border px-3 py-2 text-sm"
                style={{ borderColor: "var(--border)" }}
              />
              <input
                value={novaTrocaConferente}
                onChange={(e) => setNovaTrocaConferente(e.target.value)}
                placeholder="Conferente *"
                className="rounded border px-3 py-2 text-sm"
                style={{ borderColor: "var(--border)" }}
              />
            </div>
          ) : null}
          {novaTrocaCausaRaiz === "erro_motorista" ? (
            <div className="grid sm:grid-cols-2 gap-2">
              <input
                value={novaTrocaCarga}
                onChange={(e) => setNovaTrocaCarga(e.target.value)}
                placeholder="Carga *"
                className="rounded border px-3 py-2 text-sm"
                style={{ borderColor: "var(--border)" }}
              />
              <input
                value={novaTrocaDriverName}
                onChange={(e) => setNovaTrocaDriverName(e.target.value)}
                placeholder="Motorista que entregou (erro) *"
                className="rounded border px-3 py-2 text-sm"
                style={{ borderColor: "var(--border)" }}
              />
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <button
              disabled={pending || !novaTrocaReason.trim() || !novaTrocaCausaRaiz}
              onClick={confirmNovaTroca}
              className="text-sm rounded px-3 py-2 disabled:opacity-60"
              style={{ background: "var(--status-warning)", color: "#fff" }}
            >
              Confirmar nova troca
            </button>
            <button onClick={resetNovaTroca} className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
              cancelar
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Adicionar observação…"
          className="rounded border px-3 py-2 text-sm"
          style={{ borderColor: "var(--border)" }}
        />
        <button
          disabled={pending || !note.trim()}
          onClick={() =>
            run(async () => {
              await addNote(requestId, note);
              setNote("");
            }, "Nota adicionada.")
          }
          className="text-sm rounded px-3 py-2 self-start border disabled:opacity-60"
          style={{ borderColor: "var(--border)" }}
        >
          Adicionar nota
        </button>
      </div>
    </div>
  );
}
