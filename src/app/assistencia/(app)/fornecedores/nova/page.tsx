import { getProfile, redirectIfSac } from "@/lib/dal";
import { listSuppliers } from "@/lib/partOrders";
import { NewSupplierReturnForm } from "@/components/assistencia/NewSupplierReturnForm";

export default async function NovaRemessaPage() {
  redirectIfSac(await getProfile());
  const suppliers = await listSuppliers();

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
        Nova remessa para fornecedor
      </h2>
      <NewSupplierReturnForm suppliers={suppliers} />
    </div>
  );
}
