import { redirect } from "next/navigation";
import { getProfile, canSeeOwnAssemblerStoreRequests } from "@/lib/dal";
import { getRequestDetail } from "@/lib/serviceRequests";
import { listAssemblersForStores } from "@/lib/payments";
import { SAC_MANAGED_TYPES, DELIVERY_REQUEST_TYPES, OWN_ASSEMBLER_STORE_IDS, OWN_ASSEMBLER_RESTRICTED_TYPES } from "@/lib/assistenciaLabels";
import { listRequestPhotos } from "@/lib/servicePhotos";
import { RequestDetailContent } from "@/components/assistencia/RequestDetailContent";
import { DeliveryRequestDetailContent } from "@/components/assistencia/DeliveryRequestDetailContent";

export const dynamic = "force-dynamic";

export default async function SolicitacaoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [profile, result] = await Promise.all([getProfile(), getRequestDetail(id)]);

  // Montagem/desmontagem/vistoria de loja com montador próprio (ver
  // OWN_ASSEMBLER_STORE_IDS) -- mesma regra da fila, mas checada aqui
  // também: sem isso, dava pra contornar o filtro da lista só sabendo o
  // link direto do chamado.
  if (
    result &&
    (OWN_ASSEMBLER_STORE_IDS as readonly string[]).includes(result.request.storeId) &&
    (OWN_ASSEMBLER_RESTRICTED_TYPES as readonly string[]).includes(result.request.type) &&
    !canSeeOwnAssemblerStoreRequests(profile)
  ) {
    redirect("/assistencia/fila");
  }

  const isSacType = result ? (SAC_MANAGED_TYPES as readonly string[]).includes(result.request.type) : false;
  const canManage =
    !!result &&
    (profile.role === "admin" ||
      (profile.role === "assistencia" && !isSacType) ||
      (profile.role === "sac" && isSacType));
  // Troca de produto, entrega de produto e envio de peça têm tela própria
  // (DeliveryRequestDetailContent) desde 17/08/2026 -- ver comentário lá.
  const isDeliveryType = !!result && (DELIVERY_REQUEST_TYPES as readonly string[]).includes(result.request.type);

  const [assemblers, photos] = await Promise.all([
    canManage && result && !isDeliveryType ? listAssemblersForStores([result.request.storeId]) : Promise.resolve([]),
    result ? listRequestPhotos(result.request.id) : Promise.resolve([]),
  ]);

  if (isDeliveryType) {
    return <DeliveryRequestDetailContent profile={profile} result={result} photos={photos} />;
  }

  return <RequestDetailContent profile={profile} result={result} assemblers={assemblers} photos={photos} />;
}
