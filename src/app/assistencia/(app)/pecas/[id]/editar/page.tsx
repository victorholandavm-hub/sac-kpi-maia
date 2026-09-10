import Link from "next/link";
import { getProfile, redirectIfSac } from "@/lib/dal";
import { getPartOrder, listSuppliers, listSupplierContacts } from "@/lib/partOrders";
import { EditPartOrderForm } from "@/components/assistencia/EditPartOrderForm";

export default async function EditPartOrderPage({ params }: { params: Promise<{ id: string }> }) {
  redirectIfSac(await getProfile());
  const { id } = await params;
  const [order, suppliers, supplierContacts] = await Promise.all([getPartOrder(id), listSuppliers(), listSupplierContacts()]);

  if (!order) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Pedido de peça não encontrado.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Link href={`/assistencia/pecas/${id}`} className="text-sm underline self-start" style={{ color: "var(--text-secondary)" }}>
        ← Voltar pro pedido
      </Link>
      <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
        Editar {order.externalReference ?? `#${order.ticketNumber}`}
      </h2>
      <EditPartOrderForm order={order} suppliers={suppliers} supplierContacts={supplierContacts} />
    </div>
  );
}
