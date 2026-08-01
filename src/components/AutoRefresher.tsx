"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Este painel autentica por cookie assinado, não por sessão do Supabase Auth
// -- então Realtime (que depende de RLS/auth.uid()) nunca entregaria eventos
// aqui. Polling simples é o mecanismo real de "tempo real" nesta tela.
export function AutoRefresher({ intervalMs = 15000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(interval);
  }, [router, intervalMs]);

  return null;
}
