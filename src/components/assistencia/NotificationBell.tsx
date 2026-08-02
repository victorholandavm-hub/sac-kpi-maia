"use client";

import { useEffect, useRef, useState } from "react";
import type { Notification } from "@/lib/notifications";

const POLL_MS = 20_000;

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" style={{ color: "var(--text-primary)" }}>
      <path
        d="M6 8a6 6 0 0 1 12 0c0 4.5 1.5 6 2 6.5H4c.5-.5 2-2 2-6.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9.5 17.5a2.5 2.5 0 0 0 5 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `há ${hours}h`;
  return `há ${Math.floor(hours / 24)}d`;
}

// "Visto" fica no localStorage do navegador, não no banco -- os papéis que
// usam este sino (loja, fábrica, admin) em geral são sessão compartilhada
// por PIN, sem conta individual pra gravar "lido por quem" -- mesma ideia
// de NewSinceBadge.tsx, só que marcando no clique em vez de no mount (senão
// nunca acumularia contador nenhum).
export function NotificationBell({
  fetchAction,
  storageKey,
}: {
  fetchAction: () => Promise<Notification[]>;
  storageKey: string;
}) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const seenStorageKey = `notif-seen-${storageKey}`;
  const [lastSeen, setLastSeen] = useState<string | null>(() =>
    typeof window === "undefined" ? null : window.localStorage.getItem(seenStorageKey)
  );
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await fetchAction();
        if (!cancelled) setNotifications(data);
      } catch {
        // Falha de rede/sessão num poll de fundo não deve gerar warning nem
        // travar nada -- só tenta de novo no próximo intervalo.
      }
    }
    load();
    const interval = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [fetchAction]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const unreadCount = lastSeen === null ? 0 : notifications.filter((n) => new Date(n.createdAt) > new Date(lastSeen)).length;

  function toggleOpen() {
    setOpen((prev) => {
      const next = !prev;
      if (next && notifications.length > 0) {
        const newest = notifications[0].createdAt;
        localStorage.setItem(seenStorageKey, newest);
        setLastSeen(newest);
      }
      return next;
    });
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={toggleOpen}
        className="relative flex items-center justify-center w-9 h-9 rounded-full"
        style={{ background: "var(--background)" }}
        aria-label="Notificações"
      >
        <BellIcon />
        {unreadCount > 0 ? (
          <span
            className="absolute -top-0.5 -right-0.5 text-[10px] font-bold rounded-full min-w-[1.1rem] h-[1.1rem] px-1 flex items-center justify-center"
            style={{ background: "var(--brand-orange)", color: "#fff" }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="absolute left-0 mt-2 w-80 max-w-[90vw] max-h-96 overflow-y-auto rounded-lg border shadow-lg z-50"
          style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
        >
          {notifications.length === 0 ? (
            <p className="text-sm p-4" style={{ color: "var(--text-muted)" }}>
              Nenhuma notificação por enquanto.
            </p>
          ) : (
            <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
              {notifications.map((n) => (
                <li key={n.id} className="p-3">
                  {n.link ? (
                    <a href={n.link} className="block hover:opacity-80">
                      <NotificationRow notification={n} />
                    </a>
                  ) : (
                    <NotificationRow notification={n} />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

function NotificationRow({ notification }: { notification: Notification }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {notification.title}
        </span>
        <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>
          {timeAgo(notification.createdAt)}
        </span>
      </div>
      {notification.message ? (
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {notification.message}
        </span>
      ) : null}
    </div>
  );
}
