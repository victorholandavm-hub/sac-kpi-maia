"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

type ToastKind = "success" | "error";

type Toast = {
  id: number;
  message: string;
  kind: ToastKind;
  leaving: boolean;
};

type ToastContextValue = {
  showToast: (message: string, kind?: ToastKind) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const VISIBLE_MS = 3000;
const EXIT_MS = 200;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const showToast = useCallback((message: string, kind: ToastKind = "success") => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, message, kind, leaving: false }]);
    setTimeout(() => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, EXIT_MS);
    }, VISIBLE_MS);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:left-auto z-50 flex flex-col items-center sm:items-end gap-2"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="rounded-lg border px-4 py-3 text-sm font-medium shadow-lg max-w-sm w-full sm:w-auto transition-all duration-200"
            style={{
              background: t.kind === "success" ? "var(--status-good)" : "var(--status-critical)",
              color: "#fff",
              borderColor: "transparent",
              opacity: t.leaving ? 0 : 1,
              transform: t.leaving ? "translateY(8px)" : "translateY(0)",
            }}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast precisa estar dentro de um ToastProvider.");
  return ctx;
}
