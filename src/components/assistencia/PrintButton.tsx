"use client";

import { logPrint } from "@/app/assistencia/actions";

// `requestIds` -- pedido do Victor 21/08/2026: "quando alguem mandar
// imprimir essas notificações fique registrado em algum lugar quem
// imprimiu, data e hora". Loga em service_request_events (ver logPrint em
// actions.ts) antes de abrir o diálogo de impressão do navegador --
// disparado e esquecido de propósito (sem await/loading), pra não atrasar
// o clique nem travar a impressão se o registro falhar por algum motivo.
export function PrintButton({ requestIds }: { requestIds: string[] }) {
  return (
    <button
      onClick={() => {
        logPrint(requestIds).catch(() => {
          // Impressão em si não pode depender do log -- se falhar, só não
          // fica registrado dessa vez, não impede a pessoa de imprimir.
        });
        window.print();
      }}
      className="print:hidden text-sm px-4 py-2 rounded font-medium self-start"
      style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
    >
      Imprimir
    </button>
  );
}
