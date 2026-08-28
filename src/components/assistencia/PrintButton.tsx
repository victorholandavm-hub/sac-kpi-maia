"use client";

import { useState } from "react";
import { logPrint } from "@/app/assistencia/actions";

export type PrintTarget = {
  id: string;
  ticketNumber: number;
  clientName: string | null;
  // Já tem evento "printed" registrado (ver logPrint/getRequestDetail) --
  // calculado no servidor, junto com `isAdmin` (ver comentário abaixo).
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
// (`!isAdmin && alreadyPrinted`). Esse componente só decide SE chama
// `window.print()` e loga (`logPrint`) só as que realmente vão sair.
export function PrintButton({ targets, isAdmin }: { targets: PrintTarget[]; isAdmin: boolean }) {
  const [blocked, setBlocked] = useState<PrintTarget[] | null>(null);

  function doPrint(ids: string[]) {
    if (ids.length === 0) return;
    logPrint(ids).catch(() => {
      // Impressão em si não pode depender do log -- se falhar, só não
      // fica registrado dessa vez, não impede a pessoa de imprimir.
    });
    window.print();
  }

  function handleClick() {
    if (isAdmin) {
      doPrint(targets.map((t) => t.id));
      return;
    }
    const already = targets.filter((t) => t.alreadyPrinted);
    if (already.length === 0) {
      doPrint(targets.map((t) => t.id));
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
                    doPrint(pendentes.map((t) => t.id));
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
