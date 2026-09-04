"use client";

import type { PaymentItem } from "@/lib/payments";
import { paymentStage } from "@/lib/payments";

const STAGE_LABELS: Record<string, string> = { a_montar: "A montar", pendente: "Pendente de liberação", liberado: "Pago" };

function csvEscape(value: string): string {
  if (/[",\n;]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("pt-BR");
}

// Pedido do Victor 03/09/2026: "preciso que você dê a opção de exportar
// para excel tanto o relatorio quanto o relatorio detalhado" -- mesmo
// padrão de PaymentsExportButton.tsx (aba Pagamentos), só que com Chamado
// e Data também (esse relatório é pensado pra conferência linha por linha,
// ver AssemblerDetailTable acima -- essas duas colunas são o que dá pra
// achar o chamado de volta a partir da planilha). Terceirizados + Manoel
// juntos num arquivo só (o nome do montador já distingue quem é quem, sem
// precisar de coluna extra) -- mais simples que dois downloads separados.
export function MontagemDetalhadoExportButton({ items }: { items: PaymentItem[] }) {
  function handleExport() {
    const header = ["Montador", "Chamado", "Data", "Loja", "Cliente", "Produto", "Quantidade", "Valor unitário", "Valor total", "Status"];
    const rows = items.map((item) => {
      const status = STAGE_LABELS[paymentStage(item.requestStatus, item.paymentReleased)];
      const unitValue = item.unitValue ?? 0;
      return [
        item.assemblerName ?? "Sem montador definido",
        `#${item.ticketNumber}`,
        formatDate(item.createdAt),
        item.storeName,
        item.clientName ?? "",
        item.product,
        String(item.quantity),
        item.unitValue !== null ? unitValue.toFixed(2).replace(".", ",") : "",
        item.unitValue !== null ? (unitValue * item.quantity).toFixed(2).replace(".", ",") : "",
        status,
      ].map(csvEscape);
    });

    const csv = [header, ...rows].map((row) => row.join(";")).join("\n");
    // BOM + ";" -- mesmo motivo de PaymentsExportButton.tsx (Excel pt-BR
    // usa vírgula como separador decimal, então trata "," como delimitador
    // de coluna por padrão; sem o BOM a acentuação abre quebrada).
    const bom = String.fromCharCode(0xfeff);
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `montagem-detalhado-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={handleExport}
      className="text-sm px-3 py-2 rounded-lg font-medium whitespace-nowrap border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-100"
    >
      Exportar CSV
    </button>
  );
}
