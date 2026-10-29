"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/assistencia/ToastProvider";
import type { ResultadoAcao } from "@/lib/odoo/logisticaTipos";

// Mesmo papel do useQuickAction do Victor, mas para as actions da
// logística do Odoo, que devolvem {ok, erro} em vez de lançar (a mensagem
// real do Odoo precisa chegar no operador).
export function useAcaoOdoo() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { showToast } = useToast();

  function run<T>(acao: () => Promise<ResultadoAcao<T>>, sucesso?: string | ((dados: T) => string), depois?: (dados: T) => void) {
    startTransition(async () => {
      try {
        const r = await acao();
        if (!r.ok) {
          showToast(r.erro, "error");
          return;
        }
        const msg = typeof sucesso === "function" ? sucesso(r.dados) : sucesso;
        if (msg) showToast(msg, "success");
        depois?.(r.dados);
        router.refresh();
      } catch (e) {
        // Tela aberta de antes de uma atualização: a action antiga não existe
        // mais (29/10, transferência Assistência → Avaria). Recarrega sozinha.
        if (e instanceof Error && /Server Action .* (was )?not found|Failed to find Server Action/i.test(e.message)) {
          showToast("O sistema foi atualizado. Recarregando a tela — faça a operação de novo.", "error");
          setTimeout(() => window.location.reload(), 1500);
          return;
        }
        // Falha de transporte (rede caiu)
        showToast(e instanceof Error ? `${e.message} — recarregue a página.` : "Erro inesperado — recarregue a página.", "error");
      }
    });
  }

  return { pending, run, showToast };
}
