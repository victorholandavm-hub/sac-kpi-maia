"use client";

import { useCallback, useEffect, useRef } from "react";
import { PIN_LENGTH } from "@/lib/pinConfig";

const LEGACY_PIN_LENGTH = 4;
const AUTO_SUBMIT_DEBOUNCE_MS = 900;

// PIN legado tem 4 dígitos, PIN novo tem 6 — como não dá pra saber de
// antemão qual é o tamanho da conta que está digitando, submete na hora
// ao bater o máximo (6) ou espera uma pausa em 4 (tempo pra quem tem PIN
// legado de 4 dígitos disparar sem precisar apertar "Entrar").
//
// Cuidado: NÃO reagenda esse envio a cada dígito digitado a partir de 4
// (só exatamente em 4) — bateu 5 já é sinal inequívoco de PIN de 6, e
// reagendar a cada dígito cria uma janela onde uma pausa natural no meio
// da digitação (ex: dígito 4 pra 5) dispara um envio truncado, consome
// uma tentativa do lockout com um PIN que na prática estava certo, e
// pode derrubar a conta em bloqueio por PIN "errado" mesmo sendo certo
// (foi o que aconteceu com a caixa da Maia Shopping M).
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
      } else if (length === LEGACY_PIN_LENGTH) {
        timeoutRef.current = setTimeout(() => {
          formRef.current?.requestSubmit();
        }, AUTO_SUBMIT_DEBOUNCE_MS);
      }
    },
    [pending]
  );

  return { formRef, onPinChange };
}
