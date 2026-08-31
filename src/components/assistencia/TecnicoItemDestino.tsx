"use client";

import { useEffect, useRef, useState } from "react";
import { setItemDestino, clearItemDestino } from "@/app/assistencia/tecnico-actions";
import { useQuickAction } from "./useQuickAction";
import {
  ITEM_DESTINOS,
  ITEM_DESTINO_LABELS,
  ITEM_DESTINO_COLORS,
  ITEM_DESTINO_NEEDS_STORE,
  ITEM_DESTINO_NEEDS_TEXT,
  type ItemDestino,
} from "@/lib/tecnicos";
import type { Store } from "@/lib/serviceRequests";
import { formatDateTimeShortBr } from "@/lib/formatDateTime";

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className="w-3.5 h-3.5 shrink-0"
      style={{ color: "var(--text-muted)", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.12s ease" }}
    >
      <path d="M5.5 7.5L10 12L14.5 7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Painel "Selecionar destino..." -- pedido do Victor 31/08/2026: substituir
// a fileira de 9 botões coloridos (poluída em linha, pior ainda numa
// tabela densa) por um combobox de seleção única, mesmo comportamento de
// clique. "mostruario"/"em_observacao"/"outro" continuam pedindo um passo
// extra antes de confirmar (ver pickingStore/pickingNote mais abaixo) --
// só a lista de opções virou um menu suspenso em vez de botões lado a lado.
function DestinoDropdown({ onPick, disabled }: { onPick: (d: ItemDestino) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative w-full max-w-[230px]">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 rounded-md pl-2.5 pr-2 py-1.5 text-xs font-medium disabled:opacity-60"
        style={{
          background: "var(--surface-1)",
          border: `1px solid ${open ? "var(--brand-green)" : "var(--border)"}`,
          color: "var(--text-muted)",
        }}
      >
        <span className="flex items-center gap-2 min-w-0">
          <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--text-muted)" }} />
          <span className="truncate">Selecionar destino…</span>
        </span>
        <ChevronIcon open={open} />
      </button>

      {open ? (
        <div
          role="listbox"
          className="absolute right-0 top-[calc(100%+4px)] z-20 w-64 max-h-72 overflow-y-auto rounded-lg py-1 shadow-lg border"
          style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
        >
          {ITEM_DESTINOS.map((d) => (
            <button
              key={d}
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => {
                setOpen(false);
                onPick(d);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left"
              style={{ color: "var(--text-primary)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ background: ITEM_DESTINO_COLORS[d] }} />
              <span className="flex-1 truncate font-medium">{ITEM_DESTINO_LABELS[d]}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

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
  // Só usado quando destino está em ITEM_DESTINO_NEEDS_TEXT -- pedido do
  // Victor 24/08/2026 ("em_observacao": "abre um campo de texto livre e
  // quando confirma ja vai para o status em observação") e 28/08/2026
  // ("outro": "abre uma caixa de texto livre pra digitar").
  destinoObservacao: string | null;
  stores: Store[];
}) {
  const { pending, run } = useQuickAction();
  // "mostruario" pede a loja, "em_observacao"/"outro" pedem uma nota --
  // os únicos destinos que abrem um passo extra antes de confirmar, o
  // resto continua clique único de sempre. `pickingNote` guarda QUAL dos
  // dois foi clicado (não só um boolean) -- precisam de placeholder e
  // destino final diferentes no mesmo textarea.
  const [pickingStore, setPickingStore] = useState(false);
  const [storeId, setStoreId] = useState("");
  const [pickingNote, setPickingNote] = useState<ItemDestino | null>(null);
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
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => clearItemDestino(itemId), "Destino desfeito -- volta pra pendente.")}
            className="text-xs underline disabled:opacity-60 shrink-0"
            style={{ color: "var(--text-secondary)" }}
          >
            ↩ desfazer
          </button>
        </div>
        {destinoDefinidoPor ? (
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {destinoDefinidoPor}
            {destinoDefinidoEm ? ` · ${formatDateTimeShortBr(destinoDefinidoEm)}` : ""}
          </span>
        ) : null}
        {ITEM_DESTINO_NEEDS_TEXT.includes(destino) && destinoObservacao ? (
          <p className="text-xs whitespace-pre-line" style={{ color: "var(--text-secondary)" }}>
            {destinoObservacao}
          </p>
        ) : null}
      </div>
    );
  }

  if (pickingStore) {
    return (
      <div className="flex flex-col gap-1.5 w-full max-w-[230px] rounded-md border p-2" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
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
        <div className="flex items-center gap-2">
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
      </div>
    );
  }

  if (pickingNote) {
    return (
      <div className="flex flex-col gap-1.5 w-full max-w-[230px] rounded-md border p-2" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={pickingNote === "outro" ? "Descreva a classificação…" : "Por que está em observação?"}
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
                () => setItemDestino(itemId, pickingNote, undefined, note),
                `Destino: ${ITEM_DESTINO_LABELS[pickingNote]}.`
              )
            }
            className="text-xs rounded-full px-2.5 py-1 font-medium disabled:opacity-60"
            style={{ background: ITEM_DESTINO_COLORS[pickingNote], color: "#fff" }}
          >
            Confirmar
          </button>
          <button
            type="button"
            onClick={() => {
              setPickingNote(null);
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
    <DestinoDropdown
      disabled={pending}
      onPick={(d) =>
        d === ITEM_DESTINO_NEEDS_STORE
          ? setPickingStore(true)
          : ITEM_DESTINO_NEEDS_TEXT.includes(d)
            ? setPickingNote(d)
            : run(() => setItemDestino(itemId, d), `Destino: ${ITEM_DESTINO_LABELS[d]}.`)
      }
    />
  );
}
