import Link from "next/link";
import { notFound } from "next/navigation";
import { requireDashboardAuth } from "@/lib/dashboardSession";
import { listComprasDoCliente } from "@/lib/clientes";
import { AppHeader } from "@/components/AppHeader";

export const dynamic = "force-dynamic";

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

// Detalhe de um cliente -- pedido do Victor 20/08/2026: "ao clicar no nome
// do cliente, aparecer as compras que ele já fez com data e valor de cada
// uma". Chegou aqui a partir do nome clicável nas duas visões de
// /clientes (Status e Nível de relacionamento) -- ver listComprasDoCliente
// em clientes.ts pro porquê do código na URL bater com os dois pontos de
// entrada (protheusCode/clientId são o mesmo valor).
export default async function ClienteDetalhePage({ params }: { params: Promise<{ codigo: string }> }) {
  await requireDashboardAuth();
  const { codigo } = await params;
  const { nome, cpfCnpj, compras } = await listComprasDoCliente(decodeURIComponent(codigo));

  if (compras.length === 0 && !nome) {
    notFound();
  }

  const totalVendas = compras.filter((c) => c.type === "Venda").reduce((sum, c) => sum + c.invoiceTotal, 0);
  const totalDevolucoes = compras.filter((c) => c.type === "Devolucao").reduce((sum, c) => sum + c.invoiceTotal, 0);

  return (
    <div className="max-w-4xl mx-auto px-6 pt-6 pb-10 flex flex-col gap-6">
      <AppHeader />

      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/clientes" className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
          ← Clientes
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
          {nome ?? "Cliente"}
        </h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {cpfCnpj ? `${cpfCnpj} · ` : ""}Código Protheus {codigo}
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="rounded-xl border p-4" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
          <span className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            {compras.filter((c) => c.type === "Venda").length}
          </span>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Compra{compras.filter((c) => c.type === "Venda").length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="rounded-xl border p-4" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
          <span className="text-2xl font-bold" style={{ color: "var(--status-good)" }}>
            {formatBRL(totalVendas)}
          </span>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Total em compras
          </p>
        </div>
        {totalDevolucoes > 0 ? (
          <div className="rounded-xl border p-4" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
            <span className="text-2xl font-bold" style={{ color: "var(--status-critical)" }}>
              {formatBRL(totalDevolucoes)}
            </span>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Total em devoluções
            </p>
          </div>
        ) : null}
      </div>

      {compras.length === 0 ? (
        <div className="rounded-lg border p-6 text-center" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Nenhuma compra encontrada pra esse cliente.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs" style={{ color: "var(--text-muted)" }}>
                  <th className="text-left font-normal px-4 py-2 whitespace-nowrap">Data</th>
                  <th className="text-left font-normal px-4 py-2 whitespace-nowrap">Tipo</th>
                  <th className="text-left font-normal px-4 py-2 whitespace-nowrap">Nota fiscal</th>
                  <th className="text-left font-normal px-4 py-2 whitespace-nowrap">Loja</th>
                  <th className="text-left font-normal px-4 py-2 whitespace-nowrap">Vendedor(a)</th>
                  <th className="text-right font-normal px-4 py-2 whitespace-nowrap">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--gridline)" }}>
                {compras.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-2 whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
                      {formatDateOnly(c.issueDate)}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
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
                    <td className="px-4 py-2 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                      {c.invoice ?? "—"}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                      {c.branch ?? "—"}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                      {c.sellerName ?? "—"}
                    </td>
                    <td
                      className="text-right px-4 py-2 whitespace-nowrap"
                      style={{ color: c.type === "Devolucao" ? "var(--status-critical)" : "var(--text-primary)" }}
                    >
                      {c.type === "Devolucao" ? "− " : ""}
                      {formatBRL(c.invoiceTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
