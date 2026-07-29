"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";
import { useToast } from "./ToastProvider";

const DEBOUNCE_MS = 500;
// Reforço por intervalo: o canal do Realtime só entrega eventos pra quem tem
// sessão de verdade do Supabase Auth (RLS filtra o resto) — gerente de loja
// e motorista/montador entram por PIN, sem essa sessão, então o canal sozinho
// nunca dispara pra eles. O polling garante que a tela atualiza de qualquer
// jeito, mesmo quando o Realtime não entrega nada.
const POLL_MS = 15000;

export function RealtimeQueueRefresher({
  requestId,
  table = "service_requests",
  eventsTable = "service_request_events",
  idColumn = "id",
  eventsIdColumn = "request_id",
  notifyOnInsert,
}: {
  requestId?: string;
  table?: string;
  eventsTable?: string;
  idColumn?: string;
  eventsIdColumn?: string;
  // Mostra um toast quando chega uma linha NOVA na tabela principal (não na
  // de eventos) -- só usado nas telas de fila (ver fila/page.tsx), o resto
  // dos usos continua em silêncio (só refresh).
  notifyOnInsert?: string;
} = {}) {
  const router = useRouter();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    const supabase = getSupabaseBrowser();

    function scheduleRefresh() {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => router.refresh(), DEBOUNCE_MS);
    }

    const channel = supabase
      .channel(requestId ? `assistencia-${table}-${requestId}` : `assistencia-${table}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          ...(requestId ? { filter: `${idColumn}=eq.${requestId}` } : {}),
        },
        (payload) => {
          if (notifyOnInsert && payload.eventType === "INSERT") showToast(notifyOnInsert, "info");
          scheduleRefresh();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: eventsTable,
          ...(requestId ? { filter: `${eventsIdColumn}=eq.${requestId}` } : {}),
        },
        scheduleRefresh
      )
      .subscribe();

    const pollInterval = setInterval(() => router.refresh(), POLL_MS);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [router, requestId, table, eventsTable, idColumn, eventsIdColumn, notifyOnInsert, showToast]);

  return null;
}
