"use client";

import { useEffect, useRef, useState } from "react";

export type PrintTarget = {
  id: string;
  ticketNumber: number;
  clientName: string | null;
  // Já tem evento "printed" registrado (ver /api/assistencia/log-print/
  // getRequestDetail) -- calculado no servidor, junto com `isAdmin` (ver
  // comentário abaixo).
  alreadyPrinted: boolean;
};

// Impedir reimpressão -- pedido do Victor 28/08/2026: "estao imprimindo
// duas vezes uma mesma notificação... quando tentassem imprimir em bloco
// e tivesse uma ou mais que ja foram impressas, aparecer um modal
// mostrando quais nao podem/nao irão ser impressas pois ja foram e quando
// fosse uma unica que fosse ser impressa, ao clicar em imprimir, aparecer
// a mensagem tambem" -- e, na sequência: "só eu poderia imprimir mais de
// uma vez" (admin sempre pode reimprimir, sem bloqueio nenhum -- por isso
// `isAdmin` desliga toda essa checagem).
//
// A exclusão física das já impressas do papel (impressão em lote parcial)
// não é feita aqui -- é CSS (`display:none` no @media print) aplicado
// pelas páginas que renderizam isso (despacho/page.tsx,
// despacho-lote/page.tsx), calculado no servidor com a mesma condição
// (`!isAdmin && alreadyPrinted`). Esse componente só decide QUANDO loga
// (via /api/assistencia/log-print) e quais ids -- as que realmente vão
// sair no papel.
//
// Achado do Victor 25/09/2026 (2ª rodada do mesmo sintoma relatado em
// 16/09/2026, já corrigido uma vez -- mas por outra causa: aquela era
// Server Action com ID de build ficando velho após deploy, já migrada pra
// rota de API comum, ver log-print/route.ts): clicar em "Imprimir" às
// vezes registrava a impressão sem nada abrir de verdade, e Ctrl+P
// imprimia de verdade sem registrar nada -- furando a trava de 1
// impressão por atendente. Causa raiz desta vez: o log disparava no
// CLIQUE, logo antes de `window.print()` -- um `window.print()` que
// falhasse por qualquer motivo (bloqueio do navegador, erro etc.) ainda
// contava como impresso; e Ctrl+P nunca passa pelo onClick, então nunca
// chegava a chamar o log.
//
// Corrigido trocando o gatilho do log de "clique no botão" pro evento
// `afterprint` do navegador -- esse evento dispara sempre que uma
// impressão de fato acontece na página, não importa como foi disparada
// (nosso botão, Ctrl+P, ou o menu do navegador). Loga só depois que a
// impressão realmente ocorreu, e cobre os 3 jeitos de imprimir, não só o
// clique no botão.
export function PrintButton({ targets, isAdmin }: { targets: PrintTarget[]; isAdmin: boolean }) {
  const [blocked, setBlocked] = useState<PrintTarget[] | null>(null);

  // IDs que vão sair de verdade no papel se uma impressão acontecer AGORA
  // nesta página -- admin reimprime tudo (nada escondido por CSS), não-
  // admin só o que ainda não tinha sido impresso (o resto já sai escondido
  // no papel via CSS, ver comentário acima). Guardado num ref (não state)
  // porque o listener de afterprint é registrado uma vez só, no mount, e
  // precisa sempre ler o valor mais atual sem precisar reatachar o
  // listener a cada render.
  const idsParaLogRef = useRef<string[]>([]);
  useEffect(() => {
    idsParaLogRef.current = isAdmin ? targets.map((t) => t.id) : targets.filter((t) => !t.alreadyPrinted).map((t) => t.id);
  }, [targets, isAdmin]);

  useEffect(() => {
    function onAfterPrint() {
      const ids = idsParaLogRef.current;
      if (ids.length === 0) return;
      fetch("/api/assistencia/log-print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestIds: ids }),
      }).catch(() => {});
    }
    window.addEventListener("afterprint", onAfterPrint);
    return () => window.removeEventListener("afterprint", onAfterPrint);
  }, []);

  function handleClick() {
    if (isAdmin) {
      window.print();
      return;
    }
    const already = targets.filter((t) => t.alreadyPrinted);
    if (already.length === 0) {
      window.print();
      return;
    }
    // Pelo menos uma já foi impressa -- mostra o aviso antes de imprimir
    // (mesmo quando é só 1 no total: nada pra imprimir, só o aviso).
    setBlocked(already);
  }

  const pendentes = targets.filter((t) => !t.alreadyPrinted);

  return (
    <>
      <button
        onClick={handleClick}
        className="print:hidden text-sm px-4 py-2 rounded font-medium self-start"
        style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
      >
        Imprimir
      </button>
      {blocked ? (
        <div className="print:hidden fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(11,11,11,0.5)" }}>
          <div className="rounded-lg p-5 max-w-md w-full flex flex-col gap-3" style={{ background: "var(--surface-1)" }}>
            <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
              {pendentes.length === 0 ? "Já impressa" : "Algumas já foram impressas"}
            </h3>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {pendentes.length === 0
                ? blocked.length === 1
                  ? "Essa notificação já foi impressa antes -- não vai ser impressa de novo."
                  : "Todas as notificações selecionadas já foram impressas antes -- nenhuma vai ser impressa."
                : `${blocked.length} de ${targets.length} já foram impressas antes e não vão ser impressas de novo:`}
            </p>
            <ul className="text-sm flex flex-col gap-1 max-h-48 overflow-y-auto">
              {blocked.map((t) => (
                <li key={t.id} style={{ color: "var(--text-primary)" }}>
                  #{t.ticketNumber}
                  {t.clientName ? ` · ${t.clientName}` : ""}
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => setBlocked(null)}
                className="text-sm px-3 py-2 rounded border"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              >
                {pendentes.length === 0 ? "Fechar" : "Cancelar"}
              </button>
              {pendentes.length > 0 ? (
                <button
                  onClick={() => {
                    setBlocked(null);
                    window.print();
                  }}
                  className="text-sm px-3 py-2 rounded font-medium"
                  style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
                >
                  Imprimir {pendentes.length === 1 ? "a restante" : `as ${pendentes.length} restantes`}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
