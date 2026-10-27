import { listarEmpresas } from "@/lib/odoo/logistica";
import { CartaCorrecaoBoard } from "@/components/logisticaOdoo/CartaCorrecaoBoard";

// 27/10/2026 (Eduardo/CD: "ainda não tem essa rotina de carta de correção no sistema"): CC-e de NF-e autorizada do CD ou das lojas.
export const dynamic = "force-dynamic";

export default async function CartaCorrecaoPage() {
  const empresas = await listarEmpresas().catch(() => []);
  return (
    <div className="flex flex-col gap-4 min-w-0">
      <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Carta de correção (CC-e)</h2>
      <CartaCorrecaoBoard empresas={empresas.filter((e) => /^2\d\d /.test(e.name)).map((e) => ({ id: e.id, name: e.name }))} />
    </div>
  );
}
