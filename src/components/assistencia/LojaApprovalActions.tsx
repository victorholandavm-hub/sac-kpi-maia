"use client";

import { useState } from "react";
import { lojaApproveMontagemConclusion } from "@/app/assistencia/loja-actions";
import { useQuickAction } from "./useQuickAction";

type Item = { id: string; product: string; quantity: number; completed: boolean };

// Aprovação da loja pra montagem/desmontagem que o montador marcou como
// concluída (total OU parcial, ver montadorCompletePartially) -- pedido do
// Victor 31/08/2026: "o gerente da loja vai precisar aprovar essa
// conclusão, e precisa ter a opção de colocar quais produtos nao foram
// montados/desmontados".
//
// Só os itens que o montador REALMENTE marcou como feito (item.completed)
// entram na lista de confirmação, com checkbox pré-marcado; desmarcar =
// "não foi feito de verdade". Os que o montador nem chegou a tentar (numa
// conclusão parcial) aparecem à parte, sem checkbox -- não tem o que
// aprovar/reprovar, pedido do Victor 02/09/2026: "o fluxo de remarcação
// deve seguir normalmente pro montador ir montar o resto da mesma
// solicitação". Eles SEMPRE entram no notDoneItemIds mandado pra
// lojaApproveMontagemConclusion (loja-actions.ts) -- é isso que garante
// que o chamado cai em "remarcar" (nunca "concluida") enquanto sobrar
// item não feito, mesmo que o gerente aprove 100% do que foi confirmado.
export function LojaApprovalActions({ requestId, items }: { requestId: string; items: Item[] }) {
  const { pending, run } = useQuickAction();
  const claimedItems = items.filter((i) => i.completed);
  const neverDoneItems = items.filter((i) => !i.completed);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set(claimedItems.map((i) => i.id)));
  const [note, setNote] = useState("");

  function toggle(id: string) {
    setDoneIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const rejectedIds = claimedItems.filter((i) => !doneIds.has(i.id)).map((i) => i.id);
  const notDoneIds = [...rejectedIds, ...neverDoneItems.map((i) => i.id)];
  const allDone = notDoneIds.length === 0;

  function approve() {
    run(
      () => lojaApproveMontagemConclusion(requestId, notDoneIds, note),
      allDone ? "Conclusão aprovada." : "Aprovado com pendência -- chamado volta pra remarcar."
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg p-3" style={{ border: "2px solid var(--brand-green)" }}>
      <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
        Confirme item por item — desmarque o que NÃO foi montado/desmontado de verdade.
      </span>
      <div className="flex flex-col gap-1.5">
        {claimedItems.map((item) => (
          <label key={item.id} className="flex items-center gap-2 text-sm rounded-lg border p-2" style={{ borderColor: "var(--border)" }}>
            <input type="checkbox" checked={doneIds.has(item.id)} onChange={() => toggle(item.id)} className="rounded" />
            <span style={{ color: "var(--text-primary)" }}>
              {item.quantity > 1 ? `${item.quantity}x ` : ""}
              {item.product}
            </span>
          </label>
        ))}
      </div>
      {neverDoneItems.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            Ainda não feito pelo montador (vai continuar pendente):
          </span>
          {neverDoneItems.map((item) => (
            <div key={item.id} className="flex items-center gap-2 text-sm rounded-lg border p-2" style={{ borderColor: "var(--border)", opacity: 0.7 }}>
              <span style={{ color: "var(--text-secondary)" }}>
                {item.quantity > 1 ? `${item.quantity}x ` : ""}
                {item.product}
              </span>
            </div>
          ))}
        </div>
      ) : null}
      {!allDone ? (
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Observação sobre o que não foi feito (opcional)…"
          className="rounded-lg border px-3 py-2.5 text-sm"
          style={{ borderColor: "var(--border)" }}
        />
      ) : null}
      <button
        disabled={pending}
        onClick={approve}
        className="text-sm rounded-lg px-3 py-2.5 font-medium disabled:opacity-60"
        style={{ background: allDone ? "var(--status-good)" : "var(--status-warning)", color: "#fff" }}
      >
        {allDone ? "Aprovar conclusão" : "Aprovar com pendência (volta pra remarcar)"}
      </button>
    </div>
  );
}
