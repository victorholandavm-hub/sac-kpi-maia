import { listarEmpresas } from "@/lib/odoo/logistica";
import { empresaDaUrl } from "@/lib/odoo/logisticaAuth";
import { InventarioBoard } from "@/components/logisticaOdoo/InventarioBoard";

// Inventário / contagem (25/10/2026 noite). Antes: contagem do SIGAEST no Protheus. O operador escolhe a loja/CD,
// digita código e quantidade contada; a tela mostra o saldo do sistema e a diferença; "Aplicar" grava o ajuste no Odoo.
export const dynamic = "force-dynamic";

export default async function InventarioPage({ searchParams }: { searchParams: Promise<{ empresa?: string }> }) {
  const sp = await searchParams;
  const empresa = empresaDaUrl(sp.empresa);
  const empresas = (await listarEmpresas().catch(() => [])).filter((e) => /^2\d\d /.test(e.name));
  return (
    <div className="flex flex-col gap-4 min-w-0">
      <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Inventário · contagem de estoque</h2>
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        Digite o código e quanto contou. A tela mostra o que o sistema tem e a diferença. Confira e clique em Aplicar: o estoque do Odoo passa a ser o contado, com histórico no Kardex.
      </p>
      <InventarioBoard empresas={empresas} empresaAtual={empresa} />
    </div>
  );
}
