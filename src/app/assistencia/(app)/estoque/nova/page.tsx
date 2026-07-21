import { getProfile, redirectIfSac } from "@/lib/dal";
import { listSuppliers } from "@/lib/partOrders";
import { NewStockMovementForm } from "@/components/assistencia/NewStockMovementForm";

export default async function NovaMovimentacaoPage() {
  redirectIfSac(await getProfile());
  const factories = await listSuppliers();

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
        Nova movimentação de estoque
      </h2>
      <NewStockMovementForm factories={factories} />
    </div>
  );
}
