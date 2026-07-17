"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "./ToastProvider";

export function useQuickAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { showToast } = useToast();

  function run(action: () => Promise<void>, successMessage?: string) {
    startTransition(async () => {
      try {
        await action();
        if (successMessage) showToast(successMessage, "success");
        router.refresh();
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Erro inesperado.", "error");
      }
    });
  }

  return { pending, run, showToast };
}
