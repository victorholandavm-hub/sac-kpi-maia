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

// Linha de cliente com histórico de compras expansível -- pedido do Victor
// 20/08/2026: "ao clicar no nome do cliente, aparecer as compras que ele já
// fez com data e valor de cada uma" + "não quero que ao clicar vá para
// outra tela, tem que expandir logo abaixo". Busca sob demanda (só no 1º
// clique, ver getComprasDoClienteAction) -- os outros <td> da linha
// (Status/Nível, telefone, etc.) continuam vindo prontos do Server
// Component pai, passados como children; só o nome + a expansão são client.
export function ClienteHistoricoRow({
  clientId,
  name,
  colSpan,
  leadingCells,
  children,
}: {
  clientId: string;
  name: string;
  // Total de colunas da tabela (leadingCells + Nome + children) -- pra
  // linha expandida ocupar a largura inteira num td colSpan só.
  colSpan: number;
  // Colunas ANTES do nome (ex.: "Posição" na visão Nível de relacionamento)
  // -- a maioria das tabelas não tem nenhuma, daí opcional.
  leadingCells?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [compras, setCompras] = useState<ClienteCompra[] | null>(null);

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (compras || loading) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getComprasDoClienteAction(clientId);
      setCompras(result.compras);
    } catch {
      setError("Não foi possível carregar as compras.");
    } finally {
      setLoading(false);
    }
  }

  const totalVendas = (compras ?? []).filter((c) => c.type === "Venda").reduce((sum, c) => sum + c.invoiceTotal, 0);
  const totalDevolucoes = (compras ?? []).filter((c) => c.type === "Devolucao").reduce((sum, c) => sum + c.invoiceTotal, 0);

  return (
    <>
      <tr>
        {leadingCells}
        <td className="px-4 py-2" style={{ color: "var(--text-primary)" }}>
          <button onClick={toggle} className="flex items-center gap-1.5 text-left underline decoration-dotted">
            <span
              className="text-xs shrink-0 transition-transform duration-150"
              style={{ color: "var(--text-muted)", transform: open ? "rotate(90deg)" : undefined }}
              aria-hidden="true"
            >
              ▶
            </span>
            {name}
          </button>
        </td>
        {children}
      </tr>
      {open ? (
        <tr>
          <td colSpan={colSpan} className="px-4 py-3" style={{ background: "var(--surface-2)" }}>
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
                    Total gasto (líquido):{" "}
                    <strong style={{ color: "var(--text-primary)" }}>{formatBRL(totalVendas + totalDevolucoes)}</strong>
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
                              devolução) -- formatBRL já mostra o sinal de menos sozinho,
                              sem precisar de outro "-" na frente (bug achado 20/08/2026: um
                              "−" extra na frente de um valor já negativo virava "− -R$..."). */}
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
          </td>
        </tr>
      ) : null}
    </>
  );
}
