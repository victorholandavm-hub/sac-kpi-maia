import { getProfile } from "@/lib/dal";
import { getRequestDetail } from "@/lib/serviceRequests";
import { listAssemblersForStores, listDrivers } from "@/lib/payments";
import { SAC_MANAGED_TYPES } from "@/lib/assistenciaLabels";
import { getRotaWeekdayConfig, getNextRotaDates, ROTAS, type Rota } from "@/lib/rotas";
import { listRequestPhotos } from "@/lib/servicePhotos";
import { RequestDetailContent } from "@/components/assistencia/RequestDetailContent";

export const dynamic = "force-dynamic";

export default async function SolicitacaoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [profile, result] = await Promise.all([getProfile(), getRequestDetail(id)]);

  const isSacType = result ? (SAC_MANAGED_TYPES as readonly string[]).includes(result.request.type) : false;
  const canManage =
    !!result &&
    (profile.role === "admin" ||
      (profile.role === "assistencia" && !isSacType) ||
      (profile.role === "sac" && isSacType));
  const isDeliveryType =
    !!result &&
    (result.request.type === "troca_produto" || result.request.type === "entrega_produto" || result.request.type === "envio_peca");

  const [assemblers, drivers, photos, rotaConfig] = await Promise.all([
    canManage && result ? listAssemblersForStores([result.request.storeId]) : Promise.resolve([]),
    canManage && isDeliveryType ? listDrivers() : Promise.resolve([]),
    result ? listRequestPhotos(result.request.id) : Promise.resolve([]),
    canManage ? getRotaWeekdayConfig() : Promise.resolve(null),
  ]);

  const nextDatesByRota = rotaConfig
    ? (Object.fromEntries(ROTAS.map((r) => [r, getNextRotaDates(r, rotaConfig)])) as Record<Rota, string[]>)
    : ({ praia: [], sul: [], centro: [] } as Record<Rota, string[]>);

  return (
    <RequestDetailContent
      profile={profile}
      result={result}
      assemblers={assemblers}
      drivers={drivers}
      photos={photos}
      nextDatesByRota={nextDatesByRota}
    />
  );
}
