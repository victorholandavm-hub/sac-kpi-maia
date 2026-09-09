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
  aguardando_resposta: ["aguardando_peca", "peca_recebida", "cancelada"],
  aguardando_peca: ["aguardando_resposta", "peca_recebida", "cancelada"],
  encerrado: [],
  cancelada: [],
};

// Depois que a peça chega, "enviada ao cliente" e "caso encerrado" são
// fatos independentes (mesmo jeito que a planilha original tratava --
// colunas separadas, não um status único avançando) -- pedido do Victor
// 09/09/2026. Cada checkbox chama updatePartOrderDelivery com o par
// completo (delivered, closed) -- o servidor deriva o status final sozinho
// (encerrado > enviada_ao_cliente > peca_recebida, mesma prioridade da
// importação do histórico).
function DeliveryCheckboxes({ orderId, status }: { orderId: string; status: string }) {
  const { pending, run } = useQuickAction();
  const [delivered, setDelivered] = useState(status === "enviada_ao_cliente");
  const [closed, setClosed] = useState(false);

  function toggleDelivered(checked: boolean) {
    setDelivered(checked);
    run(() => updatePartOrderDelivery(orderId, checked, closed), checked ? "Marcado como entregue ao cliente." : "Desmarcado.");
  }
  function toggleClosed(checked: boolean) {
    setClosed(checked);
    run(() => updatePartOrderDelivery(orderId, delivered, checked), checked ? "Caso encerrado." : "Reaberto.");
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-primary)" }}>
        <input type="checkbox" checked={delivered} disabled={pending} onChange={(e) => toggleDelivered(e.target.checked)} className="rounded" />
        Entregue ao cliente?
      </label>
      <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-primary)" }}>
        <input type="checkbox" checked={closed} disabled={pending} onChange={(e) => toggleClosed(e.target.checked)} className="rounded" />
        Caso encerrado?
      </label>
    </div>
  );
}

export function PartOrderActions({ orderId, status }: { orderId: string; status: string }) {
  const { pending, run } = useQuickAction();
  const [note, setNote] = useState("");

  const nextStatuses = NEXT_STATUSES[status] ?? [];
  const showDeliveryCheckboxes = status === "peca_recebida" || status === "enviada_ao_cliente";

  return (
    <div
      className="flex flex-col gap-3 rounded-lg p-4"
      style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}
    >
      <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
        Ações
      </h3>

      {showDeliveryCheckboxes ? (
        <DeliveryCheckboxes orderId={orderId} status={status} />
      ) : nextStatuses.length > 0 ? (
        <div className="flex items-center gap-2 flex-wrap">
          {nextStatuses.map((s) => (
            <button
              key={s}
              disabled={pending}
              onClick={() =>
                run(() => updatePartOrderStatus(orderId, s), `Status atualizado para ${PART_ORDER_STATUS_LABELS[s] ?? s}.`)
              }
              className="text-sm rounded px-3 py-2 border disabled:opacity-60"
              style={{ borderColor: "var(--border)" }}
            >
              Marcar como {PART_ORDER_STATUS_LABELS[s] ?? s}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {status === "cancelada" ? "Pedido cancelado." : "Pedido encerrado."}
        </p>
      )}

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
              await addPartOrderNote(orderId, note);
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
