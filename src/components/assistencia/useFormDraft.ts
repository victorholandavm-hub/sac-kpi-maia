"use client";

import { useEffect } from "react";

// Rascunho de formulário em localStorage -- pedido do Victor 15/09/2026:
// "eu estar na aba de entregas, ir para aba de solicitação de assistencia,
// e quando voltar na aba entregas, ele voltar para mesma tela... por
// exemplo preenchendo uma notificação de assistencia". Sair da página
// (Link/navegação, não submit) desmonta o componente e perde todo o
// useState -- esse hook guarda/restaura o formulário inteiro pelo próprio
// DOM (via FormData), sem precisar tocar em cada useState individual dos
// formulários (Nova entrega/Nova visita/SAC têm dezenas de campos cada).
//
// Funciona em qualquer <form ref={formRef}>: escreve um snapshot a cada
// mudança (debounced) e, ao montar, reaplica esse snapshot nos campos --
// pra campos CONTROLADOS (value+onChange do React) só setar `.value` no
// DOM não é o bastante (React não percebe) -- por isso usa o setter nativo
// + dispatchEvent, o mesmo truque usado por bibliotecas de automação de
// formulário pra "avisar" o onChange de fora do React.
//
// Limitações aceitas de propósito (dado o custo x benefício de um rascunho
// -- perder isso não perde a solicitação em si, só obriga redigitar):
// - Campos com o MESMO `name` repetido (listas dinâmicas tipo os itens de
//   produto/peça, que crescem com "+ adicionar") só restauram o 1º valor
//   -- não recria linhas extras que o usuário tinha adicionado.
// - Arquivos (input type="file", ex. nota fiscal do SAC) nunca entram --
//   FormData nem devolve o conteúdo do arquivo de um jeito serializável.
export function useFormDraft(formRef: React.RefObject<HTMLFormElement | null>, storageKey: string, skip: readonly string[] = []) {
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    function applyDraft() {
      let raw: string | null;
      try {
        raw = localStorage.getItem(storageKey);
      } catch {
        return; // localStorage indisponível (aba anônima, cota cheia etc.)
      }
      if (!raw) return;
      let draft: Record<string, string>;
      try {
        draft = JSON.parse(raw);
      } catch {
        return;
      }
      for (const [name, value] of Object.entries(draft)) {
        if (skip.includes(name)) continue;
        const el = form!.elements.namedItem(name);
        if (!el || el instanceof RadioNodeList) continue; // campo de lista (mesmo name repetido) -- pula, ver comentário acima
        if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
          const shouldCheck = value === "on" || value === "true";
          if (el.checked !== shouldCheck) {
            el.checked = shouldCheck;
            el.dispatchEvent(new Event("change", { bubbles: true }));
          }
          continue;
        }
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

    // 2 passadas: campo que só existe no DOM depois de outro campo já
    // restaurado (ex.: "Apto/Bloco" só aparece depois que "É apartamento?"
    // foi marcado, que por sua vez só reflete no DOM um tick depois do
    // dispatchEvent acima) fica de fora na 1ª -- a 2ª, ~60ms depois, pega.
    applyDraft();
    const secondPass = setTimeout(applyDraft, 60);

    function saveDraft() {
      const data = new FormData(form!);
      const snapshot: Record<string, string> = {};
      for (const [name, value] of data.entries()) {
        if (skip.includes(name) || typeof value !== "string" || name in snapshot) continue;
        snapshot[name] = value;
      }
      try {
        localStorage.setItem(storageKey, JSON.stringify(snapshot));
      } catch {
        // localStorage indisponível -- rascunho simplesmente não persiste.
      }
    }
    let debounce: ReturnType<typeof setTimeout> | null = null;
    function onInput() {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(saveDraft, 400);
    }
    // Limpa no submit (sucesso ou erro) -- sem isso um formulário já
    // criado deixaria um rascunho velho pra "ressuscitar" da próxima vez
    // que a página abrir em branco.
    function onSubmit() {
      if (debounce) clearTimeout(debounce);
      try {
        localStorage.removeItem(storageKey);
      } catch {}
    }

    form.addEventListener("input", onInput);
    form.addEventListener("change", onInput);
    form.addEventListener("submit", onSubmit);
    return () => {
      clearTimeout(secondPass);
      if (debounce) clearTimeout(debounce);
      form!.removeEventListener("input", onInput);
      form!.removeEventListener("change", onInput);
      form!.removeEventListener("submit", onSubmit);
    };
    // formRef é estável (mesmo objeto ref durante a vida do componente) --
    // só storageKey/skip precisam disparar de novo se mudarem de verdade.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, skip.join(",")]);
}
