"use client";

import { useEffect } from "react";

// Pré-preenche um formulário a partir de outro lugar do sistema -- hoje só
// usado pelo botão "Criar nova visita/entrega" de um cadastro (Controle
// Assistência -> Cadastros, pedido do Victor 02/10/2026: "coloca uma opção
// para no cadastro conseguirmos puxar os dados já para uma entrega ou
// montagem/vistoria/troca de peça"). Mesmo truque de useFormDraft.ts
// (setter nativo + dispatchEvent, porque boa parte dos campos é controlada
// por React) -- só que aplica os `values` recebidos uma vez, na montagem,
// em vez de um snapshot salvo em localStorage. Chamado DEPOIS de
// useFormDraft no mesmo form (ordem de declaração dos hooks no componente)
// -- os valores vindos do cadastro vencem um rascunho velho que porventura
// exista daquele formulário.
export function useFormPrefill(formRef: React.RefObject<HTMLFormElement | null>, values: Record<string, string>) {
  const entries = Object.entries(values).filter(([, v]) => v);
  const key = entries.map(([k, v]) => `${k}=${v}`).join("&");

  useEffect(() => {
    const form = formRef.current;
    if (!form || entries.length === 0) return;

    function apply() {
      for (const [name, value] of entries) {
        const el = form!.elements.namedItem(name);
        if (!el || el instanceof RadioNodeList) continue;
        if (el instanceof HTMLSelectElement) {
          const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
          setter?.call(el, value);
          el.dispatchEvent(new Event("change", { bubbles: true }));
        } else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
          const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
          setter?.call(el, value);
          el.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }
    }

    // 2 passadas, mesmo motivo de useFormDraft.ts -- campo condicional
    // (ex.: "Apto/Bloco") só existe no DOM depois de outro já aplicado.
    apply();
    const secondPass = setTimeout(apply, 60);
    return () => clearTimeout(secondPass);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
