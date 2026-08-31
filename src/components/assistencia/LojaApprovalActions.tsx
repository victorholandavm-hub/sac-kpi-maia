"use client";

import { useState } from "react";
import { lojaApproveMontagemConclusion } from "@/app/assistencia/loja-actions";
import { useQuickAction } from "./useQuickAction";

type Item = { id: string; product: string; quantity: number };

// Aprovação da loja pra montagem/desmontagem que o montador marcou como
// concluída -- pedido do Victor 31/08/2026: "o gerente da loja vai
// precisar aprovar essa conclusão, e precisa ter a opção de colocar
// quais produtos nao foram montados/desmontados". Todo item começa
// marcado (o montador já disse que fez); desmarcar = "não foi feito de
// verdade" -- ver lojaApproveMontagemConclusion (loja-actions.ts), que
// reaproveita o mesmo desfecho de montadorCompletePartially (remarcar)
// pros itens desmarcados.
export function LojaApprovalActions({ requestId, items }: { requestId: string; items: Item[] }) {
  const { pending, run } = useQuickAction();
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set(items.map((i) => i.id)));
  const [note, setNote] = useState("");

  function toggle(id: string) {
    setDoneIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const notDoneIds = items.filter((i) => !doneIds.has(i.id)).map((i) => i.id);
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
        {items.map((item) => (
          <label key={item.id} className="flex items-center gap-2 text-sm rounded-lg border p-2" style={{ borderColor: "var(--border)" }}>
            <input type="checkbox" checked={doneIds.has(item.id)} onChange={() => toggle(item.id)} className="rounded" />
            <span style={{ color: "var(--text-primary)" }}>
              {item.quantity > 1 ? `${item.quantity}x ` : ""}
              {item.product}
            </span>
          </label>
        ))}
      </div>
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
