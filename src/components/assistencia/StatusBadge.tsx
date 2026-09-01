"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { STATUS_LABELS, STATUS_COLORS, STATUS_DESCRIPTIONS } from "@/lib/assistenciaLabels";

const POPOVER_WIDTH = 224; // w-56

export function StatusBadge({
  status,
  showInfo,
  size = "sm",
}: {
  status: string;
  showInfo?: boolean;
  size?: "sm" | "md";
}) {
  const color = STATUS_COLORS[status] ?? "var(--text-muted)";
  const description = showInfo ? STATUS_DESCRIPTIONS[status] : undefined;
  const sizeClasses = size === "md" ? "text-sm px-3 py-1" : "text-xs px-2 py-0.5";

  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Portal pra fora da lista (que tem overflow-hidden pra arredondar os cantos
  // do card, ver loja/page.tsx) -- um popover absolute comum ficaria cortado
  // pela borda do card antes mesmo de chegar na borda da tela. Posição
  // calculada na hora de abrir, clampeada pra nunca passar da largura da
  // tela (mesmo bug que corrigimos no sino de notificações, aqui o "âncora"
  // pode estar em qualquer ponto da linha, não só na ponta esquerda).
  function toggle() {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const left = Math.min(Math.max(8, rect.left), window.innerWidth - POPOVER_WIDTH - 8);
      setPos({ top: rect.bottom + 4, left });
    }
    setOpen((v) => !v);
  }

  useEffect(() => {
    if (!open) return;
    function close() {
      setOpen(false);
    }
    function onClickOutside(e: MouseEvent) {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) close();
    }
    document.addEventListener("mousedown", onClickOutside);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <span className="inline-flex items-center gap-1">
      {/* Preenchimento suave (14% da cor sobre branco) + texto na própria
          cor -- Guia de Componentes Maia (Design System, 01/09/2026):
          mesma anatomia de badge usada na tela da equipe técnica, "a cor
          já entrega o significado antes do texto". */}
      {/* Texto escurecido (color-mix com preto) em cima da cor crua --
          alguns status (aberta, aguardando_aprovacao) são um amarelo claro
          demais pra funcionar como texto direto (contraste ~1.9:1 contra
          branco, bem abaixo do mínimo de leitura); misturar preto garante
          contraste em qualquer cor de status, sem precisar de exceção por
          status. O fundo continua com a cor crua (só 14%, sutil). */}
      <span
        className={`inline-flex items-center ${sizeClasses} rounded-full whitespace-nowrap font-semibold`}
        style={{ color: `color-mix(in srgb, ${color} 70%, black)`, background: `color-mix(in srgb, ${color} 14%, white)` }}
      >
        {STATUS_LABELS[status] ?? status}
      </span>
      {description ? (
        <>
          <button
            ref={triggerRef}
            type="button"
            onClick={toggle}
            className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold text-gray-400 border border-gray-200 hover:border-gray-300 hover:text-gray-600 transition-colors duration-150 select-none"
            aria-label={`O que significa "${STATUS_LABELS[status] ?? status}"?`}
          >
            i
          </button>
          {open && pos && typeof document !== "undefined"
            ? createPortal(
                <div
                  className="fixed z-50 rounded-lg border border-gray-200 bg-white p-2.5 text-xs text-gray-600 shadow-lg"
                  style={{ top: pos.top, left: pos.left, width: POPOVER_WIDTH }}
                >
                  {description}
                </div>,
                document.body
              )
            : null}
        </>
      ) : null}
    </span>
  );
}
