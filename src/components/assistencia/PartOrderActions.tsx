"use client";

import { useState } from "react";
import { updatePartOrderStatus, updatePartOrderDelivery, addPartOrderNote } from "@/app/assistencia/pecas-actions";
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
// sequência) -- ver DeliveryCheckboxes abaixo.
const NEXT_STATUSES: Record<string, string[]> = {
  aguardando_resposta: ["peca_recebida", "aguardando_peca", "cancelada"],
  aguardando_peca: ["peca_recebida", "aguardando_resposta", "cancelada"],
  encerrado: [],
  cancelada: [],
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

// Depois que a peça chega, "enviada ao cliente" e "caso encerrado" são
// fatos independentes (mesmo jeito que a planilha original tratava --
// colunas separadas, não um status único avançando) -- pedido do Victor
// 09/09/2026. Cada checkbox chama updatePartOrderDelivery com o par
// completo (delivered, closed) -- o servidor deriva o status final sozinho
// (encerrado > enviada_ao_cliente > peca_recebida, mesma prioridade da
// importação do histórico). Estilo de cartão clicável em vez de checkbox
// nu -- pedido do Victor 10/09/2026 (item 3, "produtividade").
//
// Continua aparecendo com status "encerrado" -- correção do Victor
// 11/09/2026: "nas peças que estão com o status de encerrado, precisam
// poder mudar de status pela equipe assistencia". Antes esses 2 checkboxes
// só apareciam pra peca_recebida/enviada_ao_cliente -- assim que o caso
// virava "encerrado" (a própria checkbox "Caso encerrado?" marcada), o card
// inteiro sumia e sobrava só o texto estático "Pedido encerrado.", sem
// nenhum controle pra desmarcar/reabrir (servidor já aceitava, ver
// updatePartOrderDelivery em pecas-actions.ts -- o buraco era só aqui na
// tela). `delivered` agora vem de fora (order.sentToClientAt, não mais
// inferido só do status) -- com status "encerrado" não dava pra saber se
// tinha sido entregue antes de fechar só olhando o status.
function DeliveryCheckboxes({ orderId, status, delivered: initialDelivered }: { orderId: string; status: string; delivered: boolean }) {
  const { pending, run } = useQuickAction();
  const [delivered, setDelivered] = useState(initialDelivered);
  const [closed, setClosed] = useState(status === "encerrado");

  function toggleDelivered(checked: boolean) {
    setDelivered(checked);
    run(() => updatePartOrderDelivery(orderId, checked, closed), checked ? "Marcado como entregue ao cliente." : "Desmarcado.");
  }
  function toggleClosed(checked: boolean) {
    setClosed(checked);
    run(() => updatePartOrderDelivery(orderId, delivered, checked), checked ? "Caso encerrado." : "Reaberto.");
  }

  return (
    <div className="grid sm:grid-cols-2 gap-2">
      <label
        className="flex items-center gap-2.5 text-sm font-medium text-gray-800 dark:text-gray-100 rounded-lg border border-gray-200 dark:border-gray-600 px-3.5 py-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150"
        style={delivered ? { borderColor: "var(--brand-green)", background: "color-mix(in srgb, var(--brand-green) 10%, var(--surface-1))" } : undefined}
      >
        <input type="checkbox" checked={delivered} disabled={pending} onChange={(e) => toggleDelivered(e.target.checked)} className="rounded w-4 h-4" />
        Entregue ao cliente?
      </label>
      <label
        className="flex items-center gap-2.5 text-sm font-medium text-gray-800 dark:text-gray-100 rounded-lg border border-gray-200 dark:border-gray-600 px-3.5 py-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150"
        style={closed ? { borderColor: "var(--brand-green)", background: "color-mix(in srgb, var(--brand-green) 10%, var(--surface-1))" } : undefined}
      >
        <input type="checkbox" checked={closed} disabled={pending} onChange={(e) => toggleClosed(e.target.checked)} className="rounded w-4 h-4" />
        Caso encerrado?
      </label>
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
}: {
  orderId: string;
  status: string;
  notes?: string | null;
  // Se já foi enviada ao cliente (order.sentToClientAt) -- só pra
  // inicializar o checkbox certo quando status já chega como "encerrado"
  // (ver DeliveryCheckboxes acima). Statuses anteriores (aguardando_*) não
  // usam esse valor.
  delivered: boolean;
}) {
  const { pending, run } = useQuickAction();
  const [note, setNote] = useState("");

  const nextStatuses = NEXT_STATUSES[status] ?? [];
  // "encerrado" entra aqui também -- pedido do Victor 11/09/2026 (ver
  // comentário em DeliveryCheckboxes). "cancelada" continua fora: não tem
  // par entregue/encerrado pra reabrir, é só terminal mesmo (pedido cancela
  // e recria do zero, se precisar).
  const showDeliveryCheckboxes = status === "peca_recebida" || status === "enviada_ao_cliente" || status === "encerrado";

  return (
    <div className="bg-white dark:bg-gray-800 border-2 rounded-xl p-6 shadow-sm flex flex-col gap-4" style={{ borderColor: "var(--brand-green)" }}>
      <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Ações</h3>

      {showDeliveryCheckboxes ? (
        <DeliveryCheckboxes orderId={orderId} status={status} delivered={delivered} />
      ) : nextStatuses.length > 0 ? (
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
      ) : (
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Pedido cancelado.</p>
      )}

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
