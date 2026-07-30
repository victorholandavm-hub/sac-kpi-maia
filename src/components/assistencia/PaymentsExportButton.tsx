"use client";

import type { PaymentItem } from "@/lib/payments";
import { paymentStage } from "@/lib/payments";

const STAGE_LABELS: Record<string, string> = { a_montar: "A montar", pendente: "Pendente", liberado: "Liberado" };

function csvEscape(value: string): string {
  if (/[",\n;]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString("pt-BR") : "";
}

// Separador ";" (não ",") -- Excel em locale pt-BR usa vírgula como
// separador decimal, então trata "," como delimitador de coluna por padrão;
// ";" é o que abre corretamente sem precisar de import manual.
export function PaymentsExportButton({ items }: { items: PaymentItem[] }) {
  function handleExport() {
    const header = ["Montador", "Produto", "Quantidade", "Cliente", "Loja", "Valor unitário", "Valor total", "Status", "Liberado em"];
    const rows = items.map((item) => {
      const stage = paymentStage(item.requestStatus, item.paymentReleased);
      const unitValue = item.unitValue ?? 0;
      return [
        item.assemblerName ?? "Sem montador definido",
        item.product,
        String(item.quantity),
        item.clientName ?? "",
        item.storeName,
        unitValue.toFixed(2).replace(".", ","),
        (unitValue * item.quantity).toFixed(2).replace(".", ","),
        STAGE_LABELS[stage],
        formatDate(item.paymentReleasedAt),
      ].map(csvEscape);
    });

    const csv = [header, ...rows].map((row) => row.join(";")).join("\n");
    // BOM no início (via code point, não caractere literal, pra não virar
    // bagunça de encoding no arquivo-fonte) -- sem isso o Excel abre
    // acentuação (ç, ã, é...) quebrada.
    const bom = String.fromCharCode(0xfeff);
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pagamentos-montadores-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={handleExport}
      className="text-sm px-3 py-2 rounded font-medium whitespace-nowrap border"
      style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
    >
      Exportar CSV
    </button>
  );
}
