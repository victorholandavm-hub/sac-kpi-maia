import { getProfile } from "@/lib/dal";
import { getRequestDetail } from "@/lib/serviceRequests";
import { listAssemblersForStores, listDrivers } from "@/lib/payments";
import { SAC_MANAGED_TYPES } from "@/lib/assistenciaLabels";
import { getRotaWeekdayConfig, getNextRotaDates, ROTAS, type Rota } from "@/lib/rotas";
import { listRequestPhotos } from "@/lib/servicePhotos";
import { RequestDetailContent } from "@/components/assistencia/RequestDetailContent";
import { RequestDetailModal } from "@/components/assistencia/RequestDetailModal";

export const dynamic = "force-dynamic";

// Versão interceptada de [id]/page.tsx -- só é alcançada por navegação
// client-side vinda de dentro de (app) (fila/agenda/pagamentos/peças);
// link direto ou refresh sempre cai na página cheia de verdade. Mesma
// busca de dados que a página cheia (ver comentário lá sobre paralelizar).
export default async function SolicitacaoDetailModalPage({ params }: { params: Promise<{ id: string }> }) {
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
    <RequestDetailModal>
      <RequestDetailContent
        profile={profile}
        result={result}
        assemblers={assemblers}
        drivers={drivers}
        photos={photos}
        nextDatesByRota={nextDatesByRota}
      />
    </RequestDetailModal>
  );
}
