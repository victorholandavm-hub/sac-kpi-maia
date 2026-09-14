import { redirect } from "next/navigation";
import Link from "next/link";
import { getTecnicoSession } from "@/app/assistencia/tecnico-actions";
import { getPartOrder, listSuppliers, listSupplierContacts } from "@/lib/partOrders";
import { EditPartOrderForm } from "@/components/assistencia/EditPartOrderForm";
import { TecnicoPecasFrame } from "@/components/assistencia/TecnicoPecasFrame";

export const dynamic = "force-dynamic";

export default async function TecnicoEditarPecaPage({ params }: { params: Promise<{ id: string }> }) {
  const tecnicoName = await getTecnicoSession();
  if (!tecnicoName) {
    redirect("/assistencia/tecnico/login");
  }
  const { id } = await params;
  const [order, suppliers, supplierContacts] = await Promise.all([getPartOrder(id), listSuppliers(), listSupplierContacts()]);

  if (!order) {
    return (
      <TecnicoPecasFrame title="Editar pedido de peça" subtitle={`Olá, ${tecnicoName}`}>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Pedido de peça não encontrado.
        </p>
      </TecnicoPecasFrame>
    );
  }

  return (
    <TecnicoPecasFrame
      title="Editar pedido de peça"
      subtitle={`Olá, ${tecnicoName} — ${order.externalReference ?? `#${order.ticketNumber}`}`}
    >
      <Link href={`/assistencia/tecnico/pecas/${id}`} className="text-sm underline self-start" style={{ color: "var(--text-secondary)" }}>
        ← Voltar pro pedido
      </Link>
      <EditPartOrderForm order={order} suppliers={suppliers} supplierContacts={supplierContacts} />
    </TecnicoPecasFrame>
  );
}
