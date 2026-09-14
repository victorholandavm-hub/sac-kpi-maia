"use client";

import { useState } from "react";
import type { ReportRowItem } from "@/lib/serviceRequests";
import { VendaVsAssistenciaBoardModal } from "./VendaVsAssistenciaBoardModal";

// Botão + modal artesanal -- mesmo padrão de StoreCategoryDrilldown.tsx
// (painel de KPIs geral). Fica em volta do conteúdo já formatado da célula
// (cor/badge do percentual, ver VendaVsAssistenciaTable.tsx) só pra
// acrescentar o clique -- não decide COMO o percentual aparece, só ONDE
// clicar.
export function VendaVsAssistenciaDrilldown({
  storeName,
  tickets,
  children,
}: {
  storeName: string;
  tickets: ReportRowItem[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  // Sem chamado no período -- nada pra abrir, mantém o conteúdo original
  // (o "—" ou percentual) sem virar botão à toa.
  if (tickets.length === 0) return <>{children}</>;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="hover:opacity-75 transition-opacity" title="Ver chamados">
        {children}
      </button>
      {open ? <VendaVsAssistenciaBoardModal storeName={storeName} tickets={tickets} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
