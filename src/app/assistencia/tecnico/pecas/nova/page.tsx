import { redirect } from "next/navigation";
import { getTecnicoSession } from "@/app/assistencia/tecnico-actions";
import { listSuppliers, listSupplierContacts } from "@/lib/partOrders";
import { NewPartOrderForm } from "@/components/assistencia/NewPartOrderForm";
import { TecnicoPecasFrame } from "@/components/assistencia/TecnicoPecasFrame";

export const dynamic = "force-dynamic";

export default async function TecnicoNovaPecaPage() {
  const tecnicoName = await getTecnicoSession();
  if (!tecnicoName) {
    redirect("/assistencia/tecnico/login");
  }

  const [suppliers, supplierContacts] = await Promise.all([listSuppliers(), listSupplierContacts()]);

  return (
    <TecnicoPecasFrame title="Novo pedido de peça" subtitle={`Olá, ${tecnicoName} — preencha os dados da peça solicitada ao fornecedor.`}>
      <NewPartOrderForm suppliers={suppliers} supplierContacts={supplierContacts} basePath="/assistencia/tecnico/pecas" />
    </TecnicoPecasFrame>
  );
}
