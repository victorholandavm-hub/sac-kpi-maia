"use client";

import { useState } from "react";
import {
  updatePartOrderStatus,
  updatePartOrderDelivery,
  addPartOrderNote,
  markResolvedWithoutPart,
  unmarkResolvedWithoutPart,
  type PartOrderDeliveryOutcome,
} from "@/app/assistencia/pecas-actions";
import { useQuickAction } from "./useQuickAction";
import { PART_ORDER_STATUS_LABELS } from "@/lib/assistenciaLabels";

// aguardando_resposta/cancelada (pedido do Victor 09/09/2026, planilha
// "Solicitação de peças") -- dos dois "aguardando", dá pra ir de um pro
// outro nos dois sentidos (fornecedor pode confirmar OU voltar a não
// responder), e cancelar vale de qualquer estado ainda aberto. cancelada é
// terminal igual encerrado -- nenhuma transição depois. peca_recebida e
// enviada_ao_cliente SAÍRAM daqui (pedido do Victor 09/09/2026: "depois que
// marca como recebida... colocar se foi entregue ao cliente e se o caso foi
// encerrado" como duas perguntas independentes, não um botão de cada vez em
// sequência) -- ver DeliveryOutcomeCard abaixo.
const NEXT_STATUSES: Record<string, string[]> = {
  aguardando_resposta: ["peca_recebida", "aguardando_peca", "cancelada"],
  aguardando_peca: ["peca_recebida", "aguardando_resposta", "cancelada"],
  encerrado: [],
  cancelada: [],
  devolvida_ao_estoque: [],
};

// "peca_recebida" é sempre a ação primária (avança o fluxo de verdade);
// cancelar é sempre a única ação "perigosa" (outline vermelho); o resto
// (trocar entre os dois "aguardando") é neutro -- pedido do Victor
// 10/09/2026, item 3: "Defina uma ação primária de destaque... enquanto
// 'Marcar como Cancelada' ou 'Aguardando resposta' podem ser outline/
// secundários".
function statusButtonVariant(s: string): "primary" | "danger" | "neutral" {
  if (s === "peca_recebida") return "primary";
  if (s === "cancelada") return "danger";
  return "neutral";
}

const BUTTON_CLASS: Record<"primary" | "danger" | "neutral", string> = {
  primary:
    "text-sm font-semibold px-4 py-2 rounded-lg text-white shadow-sm transition-colors duration-150 hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-60",
  danger:
    "text-sm font-semibold px-4 py-2 rounded-lg border-2 transition-colors duration-150 hover:bg-red-50 dark:hover:bg-red-950/30 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-60",
  neutral:
    "text-sm font-semibold px-4 py-2 rounded-lg border transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-60",
};

function StatusButton({ s, pending, onClick }: { s: string; pending: boolean; onClick: () => void }) {
  const variant = statusButtonVariant(s);
  const style: React.CSSProperties =
    variant === "primary"
      ? { background: "var(--brand-green)" }
      : variant === "danger"
        ? { borderColor: "var(--status-critical)", color: "var(--status-critical)" }
        : { borderColor: "var(--border)", color: "var(--text-primary)" };

  return (
    <button key={s} disabled={pending} onClick={onClick} className={BUTTON_CLASS[variant]} style={style}>
      {variant === "primary" ? "✓ " : variant === "danger" ? "✕ " : ""}
      Marcar como {PART_ORDER_STATUS_LABELS[s] ?? s}
    </button>
  );
}

function formatDateTimeShort(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// Diferenciação CASO x PEÇA -- pedido do Victor 14/09/2026: "às vezes
// consegue a peça por outros meios... encerra o caso do cliente e só
// depois a peça chega", esclarecido em seguida: "preciso que haja dentro
// da solicitação a diferenciação entre a solicitação do cliente e a peça
// ligada a ele. Pois o caso fica encerrado, mas nós ainda estamos
// aguardando a peça". Essa marcação é INDEPENDENTE do status (o pedido
// continua seu fluxo normal até a peça chegar de verdade) -- só avisa: a
// partir de agora, não tem mais cliente esperando por ela (ver
// DeliveryOutcomeCard abaixo, que passa a oferecer "devolvida ao estoque"
// como desfecho).
function ResolvedWithoutPartToggle({
  orderId,
  resolvedAt,
  resolvedBy,
}: {
  orderId: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
}) {
  const { pending, run } = useQuickAction();

  if (resolvedAt) {
    return (
      <div
        className="flex items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 text-sm flex-wrap"
        style={{ borderColor: "var(--brand-orange)", background: "color-mix(in srgb, var(--brand-orange) 10%, var(--surface-1))" }}
      >
        <span className="font-medium" style={{ color: "var(--text-primary)" }}>
          ⚠ Cliente já resolvido sem esta peça ({formatDateTimeShort(resolvedAt)}
          {resolvedBy ? `, ${resolvedBy}` : ""}). Quando a peça chegar, devolva ao estoque.
        </span>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => unmarkResolvedWithoutPart(orderId), "Desmarcado.")}
          className="text-xs font-semibold underline shrink-0 disabled:opacity-60"
          style={{ color: "var(--text-secondary)" }}
        >
          desfazer
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => run(() => markResolvedWithoutPart(orderId), "Marcado: cliente já resolvido sem esta peça.")}
      className="text-sm font-medium text-left underline disabled:opacity-60 self-start"
      style={{ color: "var(--text-secondary)" }}
    >
      Cliente já foi resolvido sem esta peça?
    </button>
  );
}

const DELIVERY_OUTCOMES: { value: PartOrderDeliveryOutcome; label: string }[] = [
  { value: "pendente", label: "Aguardando decisão" },
  { value: "entregue", label: "Entregue ao cliente" },
  { value: "devolvida_estoque", label: "Devolvida ao estoque" },
];

function initialOutcome(status: string, delivered: boolean): PartOrderDeliveryOutcome {
  if (status === "devolvida_ao_estoque") return "devolvida_estoque";
  if (delivered) return "entregue";
  return "pendente";
}

// Depois que a peça chega, o desfecho é uma escolha entre 3 caminhos
// mutuamente exclusivos (mesmo espírito das 2 checkboxes independentes de
// antes -- pedido do Victor 09/09/2026 -- ampliado 14/09/2026 pra incluir
// "devolvida ao estoque"). "Caso encerrado?" continua uma pergunta à parte,
// só relevante em cima de "entregue" (devolvida ao estoque já é terminal
// sozinha). Estilo de cartão clicável -- pedido do Victor 10/09/2026 (item
// 3, "produtividade").
//
// Continua aparecendo com status "encerrado"/"devolvida_ao_estoque" --
// correção do Victor 11/09/2026: "nas peças que estão com o status de
// encerrado, precisam poder mudar de status pela equipe assistencia" --
// sem isso o card sumia e sobrava só texto estático, sem controle pra
// desmarcar/reabrir.
function DeliveryOutcomeCard({ orderId, status, delivered: initialDelivered }: { orderId: string; status: string; delivered: boolean }) {
  const { pending, run } = useQuickAction();
  const [outcome, setOutcome] = useState<PartOrderDeliveryOutcome>(initialOutcome(status, initialDelivered));
  const [closed, setClosed] = useState(status === "encerrado");

  function choose(next: PartOrderDeliveryOutcome) {
    setOutcome(next);
    run(
      () => updatePartOrderDelivery(orderId, next, closed),
      next === "devolvida_estoque" ? "Marcada como devolvida ao estoque." : next === "entregue" ? "Marcado como entregue ao cliente." : "Desmarcado."
    );
  }
  function toggleClosed(checked: boolean) {
    setClosed(checked);
    run(() => updatePartOrderDelivery(orderId, outcome, checked), checked ? "Caso encerrado." : "Reaberto.");
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid sm:grid-cols-3 gap-2">
        {DELIVERY_OUTCOMES.map((o) => (
          <label
            key={o.value}
            className="flex items-center gap-2.5 text-sm font-medium rounded-lg border px-3.5 py-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150"
            style={
              outcome === o.value
                ? { color: "var(--text-primary)", borderColor: "var(--brand-green)", background: "color-mix(in srgb, var(--brand-green) 10%, var(--surface-1))" }
                : { color: "var(--text-primary)", borderColor: "var(--border)" }
            }
          >
            <input
              type="radio"
              name={`outcome-${orderId}`}
              checked={outcome === o.value}
              disabled={pending}
              onChange={() => choose(o.value)}
              className="w-4 h-4"
            />
            {o.label}
          </label>
        ))}
      </div>

      {outcome === "entregue" ? (
        <label
          className="flex items-center gap-2.5 text-sm font-medium rounded-lg border px-3.5 py-2.5 cursor-pointer self-start hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150"
          style={
            closed
              ? { color: "var(--text-primary)", borderColor: "var(--brand-green)", background: "color-mix(in srgb, var(--brand-green) 10%, var(--surface-1))" }
              : { color: "var(--text-primary)", borderColor: "var(--border)" }
          }
        >
          <input type="checkbox" checked={closed} disabled={pending} onChange={(e) => toggleClosed(e.target.checked)} className="rounded w-4 h-4" />
          Caso encerrado?
        </label>
      ) : null}
    </div>
  );
}

// Histórico de observações -- pedido do Victor 10/09/2026, item 4: "Exiba
// a área de observações antigas... de forma limpa, como uma lista de
// histórico... abaixo do formulário de novas notas". `notes` é um campo de
// texto só (não uma tabela própria) que addPartOrderNote concatena como
// "[data] texto" por linha (ver pecas-actions.ts) -- notas antigas da
// planilha importada (ex.: "OBS: MICHAEL") não têm esse prefixo de data,
// então cada linha vira um item, com a data destacada só quando o padrão
// bate.
const NOTE_LINE_PATTERN = /^\[(.+?)\]\s*(.*)$/;

function NotesHistory({ notes }: { notes: string }) {
  const lines = notes.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 pt-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Histórico</span>
      <ul className="flex flex-col gap-2">
        {[...lines].reverse().map((line, i) => {
          const match = line.match(NOTE_LINE_PATTERN);
          return (
            <li key={i} className="flex items-start gap-2.5 text-sm border-l-2 border-gray-200 dark:border-gray-600 pl-3 py-0.5">
              {match ? (
                <>
                  <span className="text-xs font-mono text-gray-400 dark:text-gray-500 whitespace-nowrap shrink-0 mt-0.5">{match[1]}</span>
                  <span className="text-gray-800 dark:text-gray-100">{match[2]}</span>
                </>
              ) : (
                <span className="text-gray-800 dark:text-gray-100">{line}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function PartOrderActions({
  orderId,
  status,
  notes,
  delivered,
  resolvedWithoutPartAt,
  resolvedWithoutPartBy,
}: {
  orderId: string;
  status: string;
  notes?: string | null;
  // Se já foi enviada ao cliente (order.sentToClientAt) -- só pra
  // inicializar o card certo quando status já chega como "encerrado" (ver
  // DeliveryOutcomeCard acima). Statuses anteriores (aguardando_*) não
  // usam esse valor.
  delivered: boolean;
  // Ver ResolvedWithoutPartToggle acima -- pedido do Victor 14/09/2026.
  resolvedWithoutPartAt: string | null;
  resolvedWithoutPartBy: string | null;
}) {
  const { pending, run } = useQuickAction();
  const [note, setNote] = useState("");

  const nextStatuses = NEXT_STATUSES[status] ?? [];
  // Devolvida_ao_estoque entra aqui também (14/09/2026), junto com
  // encerrado (11/09/2026: "nas peças que estão com o status de encerrado,
  // precisam poder mudar de status pela equipe assistencia") -- "cancelada"
  // continua fora: não tem desfecho pra reabrir, é só terminal mesmo
  // (pedido cancela e recria do zero, se precisar).
  const showDeliveryOutcome = status === "peca_recebida" || status === "enviada_ao_cliente" || status === "encerrado" || status === "devolvida_ao_estoque";
  const showNextStatusButtons = !showDeliveryOutcome && nextStatuses.length > 0;
  // "Cliente já resolvido sem esta peça?" só faz sentido enquanto o pedido
  // ainda não tem um desfecho -- ver BLOCKED_FOR_RESOLVED_WITHOUT_PART
  // (pecas-actions.ts), mesma lista.
  const canMarkResolvedWithoutPart = !["enviada_ao_cliente", "encerrado", "cancelada", "devolvida_ao_estoque"].includes(status);

  return (
    <div className="bg-white dark:bg-gray-800 border-2 rounded-xl p-6 shadow-sm flex flex-col gap-4" style={{ borderColor: "var(--brand-green)" }}>
      <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Ações</h3>

      {canMarkResolvedWithoutPart ? (
        <ResolvedWithoutPartToggle orderId={orderId} resolvedAt={resolvedWithoutPartAt} resolvedBy={resolvedWithoutPartBy} />
      ) : null}

      {showNextStatusButtons ? (
        <div className="flex items-center gap-2 flex-wrap">
          {nextStatuses.map((s) => (
            <StatusButton
              key={s}
              s={s}
              pending={pending}
              onClick={() => run(() => updatePartOrderStatus(orderId, s), `Status atualizado para ${PART_ORDER_STATUS_LABELS[s] ?? s}.`)}
            />
          ))}
        </div>
      ) : null}

      {showDeliveryOutcome ? <DeliveryOutcomeCard orderId={orderId} status={status} delivered={delivered} /> : null}

      {status === "cancelada" ? <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Pedido cancelado.</p> : null}

      <div className="flex flex-col gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={1}
            placeholder="Adicionar observação…"
            className="flex-1 min-w-0 text-sm rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none resize-none"
          />
          <button
            disabled={pending || !note.trim()}
            onClick={() =>
              run(async () => {
                await addPartOrderNote(orderId, note);
                setNote("");
              }, "Nota adicionada.")
            }
            className="text-sm font-semibold px-4 py-2 rounded-lg text-white shrink-0 disabled:opacity-60 hover:brightness-110 transition-colors duration-150"
            style={{ background: "var(--brand-green)" }}
          >
            Adicionar
          </button>
        </div>

        {notes ? <NotesHistory notes={notes} /> : null}
      </div>
    </div>
  );
}
