import { redirect } from "next/navigation";
import { getTecnicoSession } from "@/app/assistencia/tecnico-actions";
import { listSuppliers } from "@/lib/partOrders";
import { NewStockMovementForm } from "@/components/assistencia/NewStockMovementForm";
import { TecnicoPecasFrame } from "@/components/assistencia/TecnicoPecasFrame";

export const dynamic = "force-dynamic";

export default async function TecnicoNovaMovimentacaoPage() {
  const tecnicoName = await getTecnicoSession();
  if (!tecnicoName) {
    redirect("/assistencia/tecnico/login");
  }

  const factories = await listSuppliers();

  return (
    <TecnicoPecasFrame title="Nova movimentação de estoque" subtitle={`Olá, ${tecnicoName} — registre a movimentação do produto.`}>
      <NewStockMovementForm factories={factories} returnHref="/assistencia/tecnico/estoque" />
    </TecnicoPecasFrame>
  );
}
