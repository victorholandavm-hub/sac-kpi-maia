"use client";

function csvEscape(value: string): string {
  if (/[",\n;]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function formatMoney(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

type MonthRow = { month: string; total: number; concluida: number };
type AssemblerIndicatorRow = { assemblerName: string; total: number; concluida: number; avgDaysToComplete: number | null };
type StoreIndicatorRow = { storeName: string; total: number; concluida: number };
type StoreReportRow = { key: string; total: number; concluida: number; cancelada: number };
type PaymentRow = [string, { total: number; pendente: number; pago: number; itens: number }];

// Um CSV só, com as seções empilhadas (título + cabeçalho + linhas + linha
// em branco, próxima seção) -- Excel abre isso numa aba só, com tudo junto.
// Pedido do Victor 03/09/2026: primeiro só "Pagamento por montador"
// (#300), revisado no mesmo pedido: "não só o pagamento do montador mas
// junto com visão mensal, desempenho do montador, analise por loja e
// solicitações por loja". Um arquivo .xlsx de verdade (várias abas)
// precisaria de uma biblioteca nova (xlsx/exceljs, nenhuma delas é
// dependência do projeto hoje) -- CSV com seções é o mesmo padrão já usado
// em PaymentsExportButton.tsx/MontagemDetalhadoExportButton.tsx (";" +
// BOM, sem import nenhum), só que num arquivo só em vez de um por tabela.
// Botão subiu pro topo da página (antes só dentro do card "Pagamento por
// montador") -- agora representa o relatório inteiro, não só uma seção; e
// evita o problema de ficar dentro de um <summary> (ver hotfix #301: bug
// real em produção por causa de um onClick preso ali dentro).
export function RelatorioExportButton({
  monthRows,
  assemblerIndicatorRows,
  storeIndicatorRows,
  storeReportRows,
  paymentRows,
}: {
  monthRows: MonthRow[];
  assemblerIndicatorRows: AssemblerIndicatorRow[];
  storeIndicatorRows: StoreIndicatorRow[];
  storeReportRows: StoreReportRow[];
  paymentRows: PaymentRow[];
}) {
  function handleExport() {
    const sections: string[][][] = [];

    sections.push([
      ["Visão Mensal"],
      ["Mês", "Total", "Concluídas"],
      ...monthRows.map((r) => [r.month, String(r.total), String(r.concluida)]),
    ]);

    sections.push([
      ["Desempenho por Montador"],
      ["Montador", "Total", "Concluídas", "Tempo médio (dias)"],
      ...assemblerIndicatorRows.map((r) => [
        r.assemblerName,
        String(r.total),
        String(r.concluida),
        r.avgDaysToComplete !== null ? formatMoney(r.avgDaysToComplete) : "—",
      ]),
    ]);

    sections.push([
      ["Análise por Loja"],
      ["Loja", "Total", "Concluídas"],
      ...storeIndicatorRows.map((r) => [r.storeName, String(r.total), String(r.concluida)]),
    ]);

    sections.push([
      ["Solicitações por loja"],
      ["Loja", "Total", "Concluídas", "Canceladas"],
      ...storeReportRows.map((r) => [r.key, String(r.total), String(r.concluida), String(r.cancelada)]),
    ]);

    sections.push([
      ["Pagamento por montador"],
      ["Montador", "Itens", "Total", "Pago", "Pendente"],
      ...paymentRows.map(([name, v]) => [name, String(v.itens), formatMoney(v.total), formatMoney(v.pago), formatMoney(v.pendente)]),
    ]);

    const lines: string[] = [];
    for (const section of sections) {
      for (const row of section) lines.push(row.map(csvEscape).join(";"));
      lines.push("");
    }
    const csv = lines.join("\n");
    // BOM -- mesmo motivo de sempre (Excel pt-BR sem isso abre acentuação
    // quebrada).
    const bom = String.fromCharCode(0xfeff);
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-assistencia-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={handleExport}
      className="text-sm px-3.5 py-2.5 rounded-lg font-semibold whitespace-nowrap border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-100 hover:border-gray-300 dark:hover:border-gray-500 transition-colors duration-150"
    >
      📊 Exportar relatório (CSV)
    </button>
  );
}
