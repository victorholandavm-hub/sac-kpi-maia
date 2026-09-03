"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
      className="w-3.5 h-3.5 shrink-0 text-gray-400 dark:text-gray-500 transition-transform duration-150"
      style={{ transform: open ? "rotate(180deg)" : "none" }}
    >
      <path d="M5.5 7.5L10 12L14.5 7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const PANEL_WIDTH = 256; // w-64

// Painel "Selecionar destino..." -- pedido do Victor 31/08/2026: substituir
// a fileira de 9 botões coloridos (poluída em linha, pior ainda numa
// tabela densa) por um combobox de seleção única, mesmo comportamento de
// clique. "mostruario"/"em_observacao"/"outro" continuam pedindo um passo
// extra antes de confirmar (ver pickingStore/pickingNote mais abaixo) --
// só a lista de opções virou um menu suspenso em vez de botões lado a lado.
//
// Achado do Victor 31/08/2026 (print em anexo): o menu suspenso, quando
// aberto na última linha da tabela, ficava cortado -- o cartão que
// arredonda os cantos da tabela usa overflow-hidden (pra cobrir os cantos
// retos da tabela por baixo do arredondamento), e isso corta qualquer
// coisa que "vaze" do card por cima OU por baixo, não só pros lados. Um
// menu absolutamente posicionado dentro dessa árvore sempre ia bater
// nesse teto quando aberto perto da borda inferior. Fix: renderiza o
// menu num portal direto no <body> (fora da árvore com overflow-hidden),
// com posição calculada a partir do retângulo do botão -- não fica mais
// preso a nenhum overflow de ancestral, em nenhuma linha da tabela.
//
// Achado do Victor 31/08/2026, rodada 2 (dois problemas no print/relato
// novo): (1) o menu "sumia" ao rolar a página DENTRO dele mesmo -- o
// listener de scroll (pra fechar quando a página rola e a posição fica
// desatualizada) usava capture:true no window, que também pega o scroll
// interno da própria lista (overflow-y-auto quando tem mais opções do
// que cabe), fechando o menu bem na hora que a pessoa tentava rolar pra
// ver o resto das 9 opções -- corrigido ignorando scroll cujo alvo é o
// próprio painel. (2) perto do fim da página (última notificação da
// tela), não sobra espaço embaixo do botão pra caber o menu inteiro
// nem rolando -- agora calcula o espaço livre acima/abaixo do botão e
// abre o menu pra cima quando faz mais sentido, com altura máxima
// ajustada ao espaço realmente disponível.
type Pos = { left: number; top?: number; bottom?: number; maxHeight: number };

function DestinoDropdown({ onPick, disabled }: { onPick: (d: ItemDestino) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  function openMenu() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) {
      setOpen(true);
      return;
    }
    const margin = 8;
    const gap = 4;
    const left = Math.min(Math.max(margin, rect.right - PANEL_WIDTH), window.innerWidth - PANEL_WIDTH - margin);
    const spaceBelow = window.innerHeight - rect.bottom - gap - margin;
    const spaceAbove = rect.top - gap - margin;
    // Prefere abrir pra baixo (padrão), só vira pra cima quando embaixo
    // não sobra nem 1 opção de altura confortável (~40px) E acima sobra
    // mais espaço -- evita virar pra cima à toa numa linha do meio da
    // tela só porque embaixo "só" cabem 6 das 9 opções (a lista já rola).
    const openUp = spaceBelow < 40 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(80, Math.min(288, openUp ? spaceAbove : spaceBelow));
    setPos(openUp ? { left, bottom: window.innerHeight - rect.top + gap, maxHeight } : { left, top: rect.bottom + gap, maxHeight });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    // Fecha em vez de reposicionar quando quem rolou foi a página (ou a
    // tabela) -- a posição calculada em relação ao botão ficaria
    // desatualizada. Mas rolar DENTRO do próprio menu (pra ver as
    // opções que não cabem) não deve fechar nada -- só ignora quando o
    // alvo do scroll é o painel.
    function onScroll(e: Event) {
      const target = e.target as Node | null;
      if (target && panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onResize() {
      setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  return (
    <div className="relative w-full max-w-[230px]">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        className={`w-full flex items-center justify-between gap-2 rounded-lg pl-2.5 pr-2 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 border transition-colors duration-150 disabled:opacity-60 ${
          open ? "border-[#1B5E3C]" : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
        }`}
      >
        <span className="flex items-center gap-2 min-w-0">
          <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0 bg-gray-300 dark:bg-gray-500" />
          <span className="truncate">Selecionar destino…</span>
        </span>
        <ChevronIcon open={open} />
      </button>

      {open && pos && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              role="listbox"
              className="fixed z-50 rounded-lg py-1 shadow-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 overflow-y-auto"
              style={{
                top: pos.top,
                bottom: pos.bottom,
                left: pos.left,
                width: PANEL_WIDTH,
                maxHeight: pos.maxHeight,
              }}
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
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-gray-800 dark:text-gray-100"
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ background: ITEM_DESTINO_COLORS[d] }} />
                  <span className="flex-1 truncate font-medium">{ITEM_DESTINO_LABELS[d]}</span>
                </button>
              ))}
            </div>,
            document.body
          )
        : null}
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
    // Badge preenchido suave (cor do destino a 14% sobre branco), não mais
    // contorno colorido -- Guia de Componentes Maia (Design System,
    // 01/09/2026): mesma anatomia de badge de status usada no resto do
    // sistema, cor entrega o significado antes do texto.
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
            style={{ color: ITEM_DESTINO_COLORS[destino], background: `color-mix(in srgb, ${ITEM_DESTINO_COLORS[destino]} 14%, var(--surface-1))` }}
          >
            {ITEM_DESTINO_LABELS[destino]}
            {destino === ITEM_DESTINO_NEEDS_STORE && destinoLojaName ? ` · ${destinoLojaName}` : ""}
          </span>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => clearItemDestino(itemId), "Destino desfeito -- volta pra pendente.")}
            className="text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-150 disabled:opacity-60 shrink-0"
          >
            ↩ desfazer
          </button>
        </div>
        {destinoDefinidoPor ? (
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {destinoDefinidoPor}
            {destinoDefinidoEm ? ` · ${formatDateTimeShortBr(destinoDefinidoEm)}` : ""}
          </span>
        ) : null}
        {ITEM_DESTINO_NEEDS_TEXT.includes(destino) && destinoObservacao ? (
          <p className="text-xs whitespace-pre-line text-gray-600 dark:text-gray-300">{destinoObservacao}</p>
        ) : null}
      </div>
    );
  }

  if (pickingStore) {
    // Sem caixa/fundo próprio -- pedido do Victor 31/08/2026: "elimine
    // completamente quaisquer caixas, cartões ou fundos brancos internos
    // nas linhas". Os controles ficam soltos na própria célula, igual ao
    // resto da tabela.
    return (
      <div className="flex flex-col gap-1.5 w-full max-w-[230px]">
        <select
          value={storeId}
          onChange={(e) => setStoreId(e.target.value)}
          className="text-xs rounded-lg border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-gray-800 dark:text-gray-100 hover:border-gray-300 dark:hover:border-gray-500 focus:border-gray-300 dark:focus:border-gray-500 focus:outline-none transition-colors duration-150"
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
            className="text-xs rounded-lg px-3 py-1.5 font-semibold text-white shadow-sm transition-all duration-200 hover:brightness-110 disabled:opacity-60 disabled:hover:brightness-100"
            style={{ background: ITEM_DESTINO_COLORS[ITEM_DESTINO_NEEDS_STORE] }}
          >
            Confirmar
          </button>
          <button
            type="button"
            onClick={() => {
              setPickingStore(false);
              setStoreId("");
            }}
            className="text-xs font-medium rounded-md px-2 py-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 hover:text-gray-700 dark:hover:text-gray-200 transition-colors duration-150"
          >
            cancelar
          </button>
        </div>
      </div>
    );
  }

  if (pickingNote) {
    // Mesma ideia do pickingStore acima -- sem caixa/fundo próprio.
    return (
      <div className="flex flex-col gap-1.5 w-full max-w-[230px]">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={pickingNote === "outro" ? "Descreva a classificação…" : "Por que está em observação?"}
          rows={2}
          className="text-xs rounded-lg border border-gray-200 dark:border-gray-600 px-2.5 py-1.5 w-full text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 hover:border-gray-300 dark:hover:border-gray-500 focus:border-gray-300 dark:focus:border-gray-500 focus:outline-none transition-colors duration-150"
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
            className="text-xs rounded-lg px-3 py-1.5 font-semibold text-white shadow-sm transition-all duration-200 hover:brightness-110 disabled:opacity-60 disabled:hover:brightness-100"
            style={{ background: ITEM_DESTINO_COLORS[pickingNote] }}
          >
            Confirmar
          </button>
          <button
            type="button"
            onClick={() => {
              setPickingNote(null);
              setNote("");
            }}
            className="text-xs font-medium rounded-md px-2 py-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 hover:text-gray-700 dark:hover:text-gray-200 transition-colors duration-150"
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
