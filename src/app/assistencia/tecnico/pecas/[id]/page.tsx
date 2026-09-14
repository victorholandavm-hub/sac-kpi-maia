import { redirect } from "next/navigation";
import { getTecnicoSession } from "@/app/assistencia/tecnico-actions";
import { PartOrderDetailContent } from "@/components/assistencia/PartOrderDetailContent";
import { TecnicoPecasFrame } from "@/components/assistencia/TecnicoPecasFrame";

export const dynamic = "force-dynamic";

export default async function TecnicoPecaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const tecnicoName = await getTecnicoSession();
  if (!tecnicoName) {
    redirect("/assistencia/tecnico/login");
  }
  const { id } = await params;

  return (
    <TecnicoPecasFrame title="Pedido de peça" subtitle={`Olá, ${tecnicoName} — detalhe do pedido.`}>
      <PartOrderDetailContent id={id} basePath="/assistencia/tecnico/pecas" />
    </TecnicoPecasFrame>
  );
}
