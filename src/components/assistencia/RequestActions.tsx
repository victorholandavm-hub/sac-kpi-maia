"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { claimRequest, updateStatus, addNote, createExchangeChild } from "@/app/assistencia/actions";
import { useQuickAction } from "./useQuickAction";
import { STATUS_LABELS, STATUS_COLORS, CAUSA_RAIZ_OPTIONS, CAUSA_RAIZ_LABELS } from "@/lib/assistenciaLabels";

// Cor de cada botão de avanço reflete o status de destino (mesma cor do
// badge que a solicitação vai ganhar) — "cancelada" some pro cinza no badge
// (histórico), mas aqui vira vermelho pra não parecer um botão inerte.
function buttonColor(status: string): string {
  if (status === "cancelada") return "var(--status-critical)";
  return STATUS_COLORS[status] ?? "var(--brand-green)";
}

const NEXT_STATUSES: Record<string, string[]> = {
  aberta: ["em_contato", "cancelada"],
  em_contato: ["em_andamento", "cancelada"],
  em_andamento: ["remarcar", "concluida", "cancelada"],
  remarcar: ["em_andamento", "concluida", "cancelada"],
  concluida: [],
  cancelada: [],
};

// Qual das próximas opções é o caminho esperado (some, cancelar sempre fica
// secundário) — usado só pra decidir qual botão vem sólido/em destaque e
// quais ficam discretos, não muda o que é permitido (isso continua 100% em
// NEXT_STATUSES + updateStatus no servidor).
const PRIMARY_NEXT_STATUS: Record<string, string> = {
  aberta: "em_contato",
  em_contato: "em_andamento",
  em_andamento: "concluida",
  remarcar: "em_andamento",
};

// Pra desfazer um clique errado (ex.: marcar "Em andamento" sem querer) —
// o servidor (updateStatus) já aceita qualquer status válido, só faltava a
// opção na tela. Fica separado dos botões de avanço, mais discreto de
// propósito, pra não incentivar uso casual.
const PREVIOUS_STATUS: Record<string, string | null> = {
  aberta: null,
  em_contato: "aberta",
  em_andamento: "em_contato",
  remarcar: "em_andamento",
  concluida: "em_andamento",
  cancelada: "em_andamento",
};

export function RequestActions({
  requestId,
  requestType,
  status,
  isAssignedToMe,
  hasAssignee,
  assigneeLabel = "o montador",
  hideClaim = false,
  hasChildExchange = false,
}: {
  requestId: string;
  requestType: string;
  status: string;
  isAssignedToMe: boolean;
  hasAssignee: boolean;
  assigneeLabel?: string;
  hideClaim?: boolean;
  // Só um filho por chamado (ver createExchangeChild) -- uma vez que a
  // próxima rodada já existe, o botão some daqui; "Nova troca" de novo só
  // depois que ELA também concluir (aí ele passa a aparecer lá).
  hasChildExchange?: boolean;
}) {
  const router = useRouter();
  const { pending, run, showToast } = useQuickAction();
  const [note, setNote] = useState("");
  const [remarcarReason, setRemarcarReason] = useState("");
  const [askingRemarcarReason, setAskingRemarcarReason] = useState(false);

  const [askingNovaTroca, setAskingNovaTroca] = useState(false);
  const [sameProduct, setSameProduct] = useState<boolean | null>(null);
  const [novaTrocaReason, setNovaTrocaReason] = useState("");
  const [novaTrocaCausaRaiz, setNovaTrocaCausaRaiz] = useState("");
  const [novaTrocaCarga, setNovaTrocaCarga] = useState("");
  const [novaTrocaConferente, setNovaTrocaConferente] = useState("");
  const [novaTrocaDriverName, setNovaTrocaDriverName] = useState("");
  const [novaTrocaCausaRaizDetalhe, setNovaTrocaCausaRaizDetalhe] = useState("");

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

  // Produto trocado pode voltar com defeito de novo -- em vez de reabrir o
  // mesmo chamado (perdia a 1ª troca), cria um chamado novo ligado a esse
  // (ver createExchangeChild no servidor). Ao confirmar, navega pro chamado
  // novo -- é ele que passa a ser o "atual" da conversa com o cliente.
  const canRequestNewExchange = requestType === "troca_produto" && status === "concluida" && !hasChildExchange;

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
    }, "Solicitação remarcada.");
  }

  // Sem montador/motorista definido não dá pra ir pra "em andamento" (ver
  // updateStatus no servidor, que é quem realmente barra isso) — some a
  // opção da lista em vez de deixar clicar e levar um erro.
  const nextStatuses = (NEXT_STATUSES[status] ?? []).filter((s) => s !== "em_andamento" || hasAssignee);
  const previousStatus = PREVIOUS_STATUS[status] ?? null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-sm p-4">
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Ações</h3>

      {!hideClaim && !isAssignedToMe ? (
        <button
          disabled={pending}
          onClick={() => run(() => claimRequest(requestId), "Solicitação assumida.")}
          className="text-sm font-semibold rounded-lg px-3.5 py-2 self-start text-white shadow-sm transition-all duration-200 hover:brightness-110 disabled:opacity-60"
          style={{ background: "var(--brand-orange)" }}
        >
          Assumir para mim
        </button>
      ) : null}

      {!hasAssignee && (NEXT_STATUSES[status] ?? []).includes("em_andamento") ? (
        <p className="text-xs" style={{ color: "var(--status-warning)" }}>
          Defina {assigneeLabel} (mais abaixo, em &quot;Atendimento&quot;) pra poder marcar como Em andamento.
        </p>
      ) : null}

      {nextStatuses.length > 0 ? (
        <div className="flex items-center gap-2 flex-wrap">
          {nextStatuses.map((s) => {
            const isPrimary = s === PRIMARY_NEXT_STATUS[status];
            const color = buttonColor(s);
            return (
              <button
                key={s}
                disabled={pending}
                onClick={() =>
                  s === "remarcar"
                    ? setAskingRemarcarReason(true)
                    : run(() => updateStatus(requestId, s), `Status atualizado para ${STATUS_LABELS[s] ?? s}.`)
                }
                className={`text-sm rounded-lg px-3 py-2 disabled:opacity-60 ${isPrimary ? "font-medium" : ""}`}
                style={
                  isPrimary
                    ? { background: color, color: "#fff" }
                    : { background: `color-mix(in srgb, ${color} 35%, var(--surface-1))`, color: "var(--text-primary)" }
                }
              >
                Marcar como {STATUS_LABELS[s] ?? s}
              </button>
            );
          })}
        </div>
      ) : null}

      {previousStatus && !canRequestNewExchange ? (
        <button
          disabled={pending}
          onClick={() =>
            run(
              () => updateStatus(requestId, previousStatus),
              `Status revertido para ${STATUS_LABELS[previousStatus] ?? previousStatus}.`
            )
          }
          className="text-xs underline self-start text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-60"
        >
          ↩ Reverter pra {STATUS_LABELS[previousStatus] ?? previousStatus} (marquei errado)
        </button>
      ) : null}

      {canRequestNewExchange && !askingNovaTroca ? (
        <button
          disabled={pending}
          onClick={() => setAskingNovaTroca(true)}
          className="text-sm rounded-lg px-3 py-2 self-start disabled:opacity-60"
          style={{ background: "var(--status-warning)", color: "#fff" }}
        >
          🔁 Produto trocado veio com problema — pedir nova troca
        </button>
      ) : null}

      {askingNovaTroca && sameProduct === null ? (
        <div className="flex flex-col gap-2 rounded-xl border p-3" style={{ borderColor: "var(--status-warning)" }}>
          <span className="text-sm text-gray-800 dark:text-gray-100">A nova troca é pelo mesmo produto ou o cliente quer outro?</span>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setSameProduct(true)}
              className="text-sm rounded-lg px-3 py-2"
              style={{ background: "var(--status-warning)", color: "#fff" }}
            >
              Mesmo produto
            </button>
            <button
              onClick={() => setSameProduct(false)}
              className="text-sm rounded-lg px-3 py-2 border text-gray-800 dark:text-gray-100"
              style={{ borderColor: "var(--status-warning)" }}
            >
              Outro produto
            </button>
            <button onClick={resetNovaTroca} className="text-sm underline text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
              cancelar
            </button>
          </div>
        </div>
      ) : null}

      {askingNovaTroca && sameProduct !== null ? (
        <div className="flex flex-col gap-2 rounded-xl border p-3" style={{ borderColor: "var(--status-warning)" }}>
          <span className="text-sm text-gray-800 dark:text-gray-100">
            {sameProduct ? "Mesmo produto" : "Outro produto"} — o que aconteceu com o produto trocado?
          </span>
          <textarea
            value={novaTrocaReason}
            onChange={(e) => setNovaTrocaReason(e.target.value)}
            rows={2}
            placeholder="Ex: veio com a mesma avaria, cliente decidiu trocar de modelo…"
            className="rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm"
            autoFocus
          />
          <select
            value={novaTrocaCausaRaiz}
            onChange={(e) => setNovaTrocaCausaRaiz(e.target.value)}
            className="rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm"
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
                className="rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm"
              />
              <input
                value={novaTrocaConferente}
                onChange={(e) => setNovaTrocaConferente(e.target.value)}
                placeholder="Conferente *"
                className="rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm"
              />
            </div>
          ) : null}
          {novaTrocaCausaRaiz === "erro_motorista" ? (
            <div className="grid sm:grid-cols-2 gap-2">
              <input
                value={novaTrocaCarga}
                onChange={(e) => setNovaTrocaCarga(e.target.value)}
                placeholder="Carga *"
                className="rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm"
              />
              <input
                value={novaTrocaDriverName}
                onChange={(e) => setNovaTrocaDriverName(e.target.value)}
                placeholder="Motorista que entregou (erro) *"
                className="rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm"
              />
            </div>
          ) : null}
          {novaTrocaCausaRaiz === "outro" ? (
            <textarea
              value={novaTrocaCausaRaizDetalhe}
              onChange={(e) => setNovaTrocaCausaRaizDetalhe(e.target.value)}
              rows={2}
              placeholder="O que houve, exatamente? *"
              className="rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm"
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
              className="text-sm rounded-lg px-3 py-2 disabled:opacity-60"
              style={{ background: "var(--status-warning)", color: "#fff" }}
            >
              Confirmar nova troca
            </button>
            <button onClick={resetNovaTroca} className="text-sm underline text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
              cancelar
            </button>
          </div>
        </div>
      ) : null}

      {askingRemarcarReason ? (
        <div className="flex flex-col gap-2 rounded-xl border p-3" style={{ borderColor: "var(--status-critical)" }}>
          <span className="text-sm text-gray-800 dark:text-gray-100">Qual o motivo da remarcação?</span>
          <textarea
            value={remarcarReason}
            onChange={(e) => setRemarcarReason(e.target.value)}
            rows={2}
            placeholder="Ex: cliente ausente, chovendo, técnico sem tempo…"
            className="rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm"
            autoFocus
          />
          <div className="flex items-center gap-2">
            <button
              disabled={pending || !remarcarReason.trim()}
              onClick={confirmRemarcar}
              className="text-sm rounded-lg px-3 py-2 disabled:opacity-60"
              style={{ background: "var(--status-critical)", color: "#fff" }}
            >
              Confirmar remarcação
            </button>
            <button
              onClick={() => {
                setAskingRemarcarReason(false);
                setRemarcarReason("");
              }}
              className="text-sm underline text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
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
          className="rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm"
        />
        <button
          disabled={pending || !note.trim()}
          onClick={() =>
            run(async () => {
              await addNote(requestId, note);
              setNote("");
            }, "Nota adicionada.")
          }
          className="text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-600 px-3.5 py-2 self-start text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500 hover:text-gray-800 dark:hover:text-gray-100 transition-colors duration-150 disabled:opacity-60"
        >
          Adicionar nota
        </button>
      </div>
    </div>
  );
}
