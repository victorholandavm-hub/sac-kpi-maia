"use client";

import { useState } from "react";
import { getComprasDoClienteAction } from "@/app/clientes/actions";
import type { ClienteCompra } from "@/lib/clientes";

function formatDateOnly(value: string): string {
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const TYPE_LABELS: Record<string, string> = {
  Venda: "Venda",
  Devolucao: "Devolução",
};

// Botão + modal com o histórico de compras do cliente -- pedido do Victor
// 16/09/2026: "fiquem com a tabela muito parecida com a lógica dessa [tela
// de Entregas]", especificamente o botão "Ver produtos (N)" que abre um
// modal em vez de expandir a linha. Mesmo dado/ação de sempre
// (getComprasDoClienteAction, busca só no 1º clique) -- só a apresentação
// muda de "expande a linha logo abaixo" pra modal, igual ProductsModalButton
// (Entregas). Substitui a expansão inline que existia em ClienteHistoricoRow.tsx
// e em ClientesNivelTable.tsx (cada uma tinha sua própria cópia dessa lógica).
export function ComprasModalButton({ clientId, count }: { clientId: string; count?: number }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [compras, setCompras] = useState<ClienteCompra[] | null>(null);

  function handleOpen(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
    if (compras || loading) return;
    setLoading(true);
    setError(null);
    getComprasDoClienteAction(clientId)
      .then((result) => setCompras(result.compras))
      .catch(() => setError("Não foi possível carregar as compras."))
      .finally(() => setLoading(false));
  }

  function close(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setOpen(false);
  }

  const totalVendas = (compras ?? []).filter((c) => c.type === "Venda").reduce((sum, c) => sum + c.invoiceTotal, 0);
  const totalDevolucoes = (compras ?? []).filter((c) => c.type === "Devolucao").reduce((sum, c) => sum + c.invoiceTotal, 0);

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap underline"
        style={{ color: "var(--text-primary)", background: "color-mix(in srgb, var(--text-secondary) 15%, var(--surface-1))" }}
      >
        📄 Ver compras{count !== undefined ? ` (${count})` : ""}
      </button>

      {open ? (
        <>
          <button
            aria-label="Fechar histórico de compras"
            onClick={close}
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.4)" }}
          />
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="fixed inset-x-4 top-[10vh] z-50 mx-auto max-w-2xl max-h-[75vh] overflow-y-auto rounded-lg border p-4 shadow-lg flex flex-col gap-3"
            style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                Compras{compras ? ` (${compras.length})` : ""}
              </h3>
              <button
                type="button"
                aria-label="Fechar"
                onClick={close}
                className="text-xs px-2 py-1 rounded"
                style={{ color: "var(--text-muted)" }}
              >
                Fechar
              </button>
            </div>
            {loading ? (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Carregando…
              </p>
            ) : error ? (
              <p className="text-sm" style={{ color: "var(--status-critical)" }}>
                {error}
              </p>
            ) : compras && compras.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Nenhuma compra encontrada pra esse cliente.
              </p>
            ) : compras ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-4 flex-wrap text-xs" style={{ color: "var(--text-secondary)" }}>
                  <span>
                    Total gasto (líquido): <strong style={{ color: "var(--text-primary)" }}>{formatBRL(totalVendas + totalDevolucoes)}</strong>
                  </span>
                  {totalDevolucoes !== 0 ? <span>Devolvido: {formatBRL(Math.abs(totalDevolucoes))}</span> : null}
                </div>
                <div className="overflow-x-auto rounded border" style={{ borderColor: "var(--border)" }}>
                  <table className="w-full text-sm" style={{ background: "var(--surface-1)" }}>
                    <thead>
                      <tr className="text-xs" style={{ color: "var(--text-muted)" }}>
                        <th className="text-left font-normal px-3 py-1.5 whitespace-nowrap">Data</th>
                        <th className="text-left font-normal px-3 py-1.5 whitespace-nowrap">Tipo</th>
                        <th className="text-left font-normal px-3 py-1.5 whitespace-nowrap">Nota fiscal</th>
                        <th className="text-left font-normal px-3 py-1.5 whitespace-nowrap">Loja</th>
                        <th className="text-left font-normal px-3 py-1.5 whitespace-nowrap">Vendedor(a)</th>
                        <th className="text-right font-normal px-3 py-1.5 whitespace-nowrap">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: "var(--gridline)" }}>
                      {compras.map((c) => (
                        <tr key={c.id}>
                          <td className="px-3 py-1.5 whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
                            {formatDateOnly(c.issueDate)}
                          </td>
                          <td className="px-3 py-1.5 whitespace-nowrap">
                            <span
                              className="text-xs font-medium px-2 py-0.5 rounded-full border whitespace-nowrap"
                              style={
                                c.type === "Devolucao"
                                  ? { color: "var(--status-critical)", borderColor: "var(--status-critical)" }
                                  : { color: "var(--status-good)", borderColor: "var(--status-good)" }
                              }
                            >
                              {TYPE_LABELS[c.type] ?? c.type}
                            </span>
                          </td>
                          <td className="px-3 py-1.5 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                            {c.invoice ?? "—"}
                          </td>
                          <td className="px-3 py-1.5 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                            {c.branch ?? "—"}
                          </td>
                          <td className="px-3 py-1.5 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                            {c.sellerName ?? "—"}
                          </td>
                          {/* invoice_total já vem líquido/assinado do Protheus (negativo pra
                              devolução) -- formatBRL já mostra o sinal de menos sozinho. */}
                          <td
                            className="text-right px-3 py-1.5 whitespace-nowrap"
                            style={{ color: c.type === "Devolucao" ? "var(--status-critical)" : "var(--text-primary)" }}
                          >
                            {formatBRL(c.invoiceTotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </>
  );
}
