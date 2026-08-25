"use client";

import { useState } from "react";
import { setItemDestino, clearItemDestino } from "@/app/assistencia/tecnico-actions";
import { useQuickAction } from "./useQuickAction";
import {
  ITEM_DESTINOS,
  ITEM_DESTINO_LABELS,
  ITEM_DESTINO_COLORS,
  ITEM_DESTINO_NEEDS_STORE,
  ITEM_DESTINO_NEEDS_NOTE,
  type ItemDestino,
} from "@/lib/tecnicos";
import type { Store } from "@/lib/serviceRequests";
import { formatDateTimeShortBr } from "@/lib/formatDateTime";

export function TecnicoItemDestino({
  itemId,
  destino,
  destinoDefinidoPor,
  destinoDefinidoEm,
  destinoLojaName,
  destinoObservacao,
  stores,
}: {
  itemId: string;
  destino: ItemDestino | null;
  destinoDefinidoPor: string | null;
  destinoDefinidoEm: string | null;
  // Só usados quando destino === "mostruario" (ver ITEM_DESTINO_NEEDS_STORE)
  // -- pedido do Victor 21/08/2026: "enviado para mostruario... eles
  // teriam que selecionar a loja pra qual foi enviada".
  destinoLojaName: string | null;
  // Só usado quando destino === "em_observacao" (ver
  // ITEM_DESTINO_NEEDS_NOTE) -- pedido do Victor 24/08/2026: "abre um
  // campo de texto livre e quando confirma ja vai para o status em
  // observação".
  destinoObservacao: string | null;
  stores: Store[];
}) {
  const { pending, run } = useQuickAction();
  // "mostruario" pede a loja, "em_observacao" pede uma nota -- os únicos
  // dois destinos que abrem um passo extra antes de confirmar, o resto
  // continua clique único de sempre.
  const [pickingStore, setPickingStore] = useState(false);
  const [storeId, setStoreId] = useState("");
  const [pickingNote, setPickingNote] = useState(false);
  const [note, setNote] = useState("");

  if (destino) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full border whitespace-nowrap"
            style={{ color: ITEM_DESTINO_COLORS[destino], borderColor: ITEM_DESTINO_COLORS[destino] }}
          >
            {ITEM_DESTINO_LABELS[destino]}
            {destino === ITEM_DESTINO_NEEDS_STORE && destinoLojaName ? ` · ${destinoLojaName}` : ""}
          </span>
          {destinoDefinidoPor ? (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {destinoDefinidoPor}
              {destinoDefinidoEm ? ` · ${formatDateTimeShortBr(destinoDefinidoEm)}` : ""}
            </span>
          ) : null}
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => clearItemDestino(itemId), "Destino desfeito -- volta pra pendente.")}
            className="text-xs underline disabled:opacity-60"
            style={{ color: "var(--text-secondary)" }}
          >
            ↩ desfazer
          </button>
        </div>
        {destino === ITEM_DESTINO_NEEDS_NOTE && destinoObservacao ? (
          <p className="text-xs whitespace-pre-line" style={{ color: "var(--text-secondary)" }}>
            {destinoObservacao}
          </p>
        ) : null}
      </div>
    );
  }

  if (pickingStore) {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <select
          value={storeId}
          onChange={(e) => setStoreId(e.target.value)}
          className="text-xs rounded border px-2 py-1"
          style={{ borderColor: "var(--border)" }}
          autoFocus
        >
          <option value="" disabled>
            Selecione a loja…
          </option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={pending || !storeId}
          onClick={() =>
            run(() => setItemDestino(itemId, ITEM_DESTINO_NEEDS_STORE, storeId), `Destino: ${ITEM_DESTINO_LABELS[ITEM_DESTINO_NEEDS_STORE]}.`)
          }
          className="text-xs rounded-full px-2.5 py-1 font-medium disabled:opacity-60"
          style={{ background: ITEM_DESTINO_COLORS[ITEM_DESTINO_NEEDS_STORE], color: "#fff" }}
        >
          Confirmar
        </button>
        <button
          type="button"
          onClick={() => {
            setPickingStore(false);
            setStoreId("");
          }}
          className="text-xs underline"
          style={{ color: "var(--text-secondary)" }}
        >
          cancelar
        </button>
      </div>
    );
  }

  if (pickingNote) {
    return (
      <div className="flex flex-col gap-1.5 w-full max-w-xs">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Por que está em observação?"
          rows={2}
          className="text-xs rounded border px-2 py-1.5 w-full"
          style={{ borderColor: "var(--border)" }}
          autoFocus
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={pending || !note.trim()}
            onClick={() =>
              run(
                () => setItemDestino(itemId, ITEM_DESTINO_NEEDS_NOTE, undefined, note),
                `Destino: ${ITEM_DESTINO_LABELS[ITEM_DESTINO_NEEDS_NOTE]}.`
              )
            }
            className="text-xs rounded-full px-2.5 py-1 font-medium disabled:opacity-60"
            style={{ background: ITEM_DESTINO_COLORS[ITEM_DESTINO_NEEDS_NOTE], color: "#fff" }}
          >
            Confirmar
          </button>
          <button
            type="button"
            onClick={() => {
              setPickingNote(false);
              setNote("");
            }}
            className="text-xs underline"
            style={{ color: "var(--text-secondary)" }}
          >
            cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {ITEM_DESTINOS.map((d) => (
        <button
          key={d}
          type="button"
          disabled={pending}
          onClick={() =>
            d === ITEM_DESTINO_NEEDS_STORE
              ? setPickingStore(true)
              : d === ITEM_DESTINO_NEEDS_NOTE
                ? setPickingNote(true)
                : run(() => setItemDestino(itemId, d), `Destino: ${ITEM_DESTINO_LABELS[d]}.`)
          }
          className="text-xs rounded-full px-2.5 py-1 border font-medium whitespace-nowrap disabled:opacity-60"
          style={{ borderColor: ITEM_DESTINO_COLORS[d], color: ITEM_DESTINO_COLORS[d] }}
        >
          {ITEM_DESTINO_LABELS[d]}
        </button>
      ))}
    </div>
  );
}
