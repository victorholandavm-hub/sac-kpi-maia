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
  const sizeClasses = size === "md" ? "text-sm font-bold px-3 py-1" : "text-xs font-semibold px-2 py-0.5";

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
      <span
        className={`inline-flex items-center gap-1.5 ${sizeClasses} rounded-full whitespace-nowrap`}
        style={{ color: "var(--text-primary)", background: `color-mix(in srgb, ${color} 35%, var(--surface-1))` }}
      >
        <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: color }} />
        {STATUS_LABELS[status] ?? status}
      </span>
      {description ? (
        <>
          <button
            ref={triggerRef}
            type="button"
            onClick={toggle}
            className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold select-none"
            style={{ color, border: `1px solid ${color}` }}
            aria-label={`O que significa "${STATUS_LABELS[status] ?? status}"?`}
          >
            i
          </button>
          {open && pos && typeof document !== "undefined"
            ? createPortal(
                <div
                  className="fixed z-50 rounded-lg border p-2 text-xs shadow-lg"
                  style={{
                    top: pos.top,
                    left: pos.left,
                    width: POPOVER_WIDTH,
                    background: "var(--surface-1)",
                    borderColor: "var(--border)",
                    color: "var(--text-secondary)",
                  }}
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
