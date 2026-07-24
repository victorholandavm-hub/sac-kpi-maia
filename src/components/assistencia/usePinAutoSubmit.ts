"use client";

import { useCallback, useEffect, useRef } from "react";
import { PIN_LENGTH } from "@/lib/pinConfig";

const AUTO_SUBMIT_DEBOUNCE_MS = 350;

// PIN legado tem 4 dígitos, PIN novo tem 6 — como não dá pra saber de
// antemão qual é o tamanho da conta que está digitando, submete na hora
// ao bater o máximo (6) ou espera uma pausa curta de digitação a partir
// de 4 (tempo pra quem tem PIN de 6 continuar digitando sem disparar
// cedo demais).
export function usePinAutoSubmit(pending: boolean) {
  const formRef = useRef<HTMLFormElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const onPinChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (pending) return;

      const length = e.target.value.length;
      if (length === PIN_LENGTH) {
        formRef.current?.requestSubmit();
      } else if (length >= 4) {
        timeoutRef.current = setTimeout(() => {
          formRef.current?.requestSubmit();
        }, AUTO_SUBMIT_DEBOUNCE_MS);
      }
    },
    [pending]
  );

  return { formRef, onPinChange };
}
