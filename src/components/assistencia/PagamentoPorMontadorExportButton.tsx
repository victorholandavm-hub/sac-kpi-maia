"use client";

function csvEscape(value: string): string {
  if (/[",\n;]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function formatMoney(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

// Pedido do Victor 03/09/2026: "preciso que você dê a opção de exportar
// para excel tanto o relatorio quanto o relatorio detalhado" -- essa é a
// tabela "Pagamento por montador" do relatório principal (assemblerRows,
// mesmo agregado por montador que já aparece na tela). Mesmo padrão de
// PaymentsExportButton.tsx (aba Pagamentos)/MontagemDetalhadoExportButton.tsx
// (relatório detalhado) -- CSV com ";" + BOM, abre certo no Excel pt-BR.
export function PagamentoPorMontadorExportButton({
  rows,
}: {
  rows: [string, { total: number; pendente: number; pago: number; itens: number }][];
}) {
  function handleExport() {
    const header = ["Montador", "Itens", "Total", "Pago", "Pendente"];
    const csvRows = rows.map(([name, v]) =>
      [name, String(v.itens), formatMoney(v.total), formatMoney(v.pago), formatMoney(v.pendente)].map(csvEscape)
    );

    const csv = [header, ...csvRows].map((row) => row.join(";")).join("\n");
    const bom = String.fromCharCode(0xfeff);
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pagamento-por-montador-${new Date().toISOString().slice(0, 10)}.csv`;
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
