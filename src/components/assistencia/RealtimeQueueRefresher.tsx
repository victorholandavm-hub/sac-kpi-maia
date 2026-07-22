"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

const DEBOUNCE_MS = 500;
// Reforço por intervalo: o canal do Realtime só entrega eventos pra quem tem
// sessão de verdade do Supabase Auth (RLS filtra o resto) — gerente de loja
// e motorista/montador entram por PIN, sem essa sessão, então o canal sozinho
// nunca dispara pra eles. O polling garante que a tela atualiza de qualquer
// jeito, mesmo quando o Realtime não entrega nada.
const POLL_MS = 15000;

export function RealtimeQueueRefresher({ requestId }: { requestId?: string } = {}) {
  const router = useRouter();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowser();

    function scheduleRefresh() {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => router.refresh(), DEBOUNCE_MS);
    }

    const channel = supabase
      .channel(requestId ? `assistencia-request-${requestId}` : "assistencia-service-requests")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "service_requests",
          ...(requestId ? { filter: `id=eq.${requestId}` } : {}),
        },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "service_request_events",
          ...(requestId ? { filter: `request_id=eq.${requestId}` } : {}),
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
  }, [router, requestId]);

  return null;
}
