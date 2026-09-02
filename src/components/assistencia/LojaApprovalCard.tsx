import { listRequestPhotos } from "@/lib/servicePhotos";
import { REQUEST_TYPE_LABELS } from "@/lib/assistenciaLabels";
import type { OpenRequestForLoja } from "@/lib/serviceRequests";
import { StatusBadge } from "./StatusBadge";
import { PhotoGallery } from "./PhotoGallery";
import { LojaApprovalActions } from "./LojaApprovalActions";

// Card da aba "Aguardando aprovação" -- pedido do Victor 31/08/2026. Busca
// as fotos aqui dentro (Server Component assíncrono, mesmo padrão de
// montador/[id]/page.tsx) pra não precisar carregar foto de TODO chamado
// aberto/concluído nas outras abas, só de quem está esperando aprovação.
export async function LojaApprovalCard({ request }: { request: OpenRequestForLoja }) {
  const photos = await listRequestPhotos(request.id);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white shadow-sm p-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-mono font-semibold text-gray-500">#{request.ticketNumber}</span>
        <StatusBadge status={request.status} showInfo />
        <span className="text-sm font-semibold text-gray-800">{REQUEST_TYPE_LABELS[request.type] ?? request.type}</span>
        <span className="text-xs font-medium text-gray-500">· {request.storeName}</span>
      </div>

      <p className="text-sm font-medium text-gray-800">{request.clientName ?? "Sem nome de cliente"}</p>
      {request.assemblerName ? <p className="text-xs font-medium text-gray-500">Montador: {request.assemblerName}</p> : null}

      <div className="flex flex-col gap-3">
        {request.items.map((item) => {
          const itemPhotos = photos.filter((p) => p.itemId === item.id);
          return (
            <div key={item.id} className="flex flex-col gap-1.5 pb-3 border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-800">
                {item.quantity > 1 ? `${item.quantity}x ` : ""}
                {item.product}
              </span>
              {itemPhotos.length > 0 ? (
                <PhotoGallery photos={itemPhotos} />
              ) : item.completed ? (
                <span className="text-xs font-medium" style={{ color: "var(--status-warning)" }}>
                  Sem foto enviada
                </span>
              ) : (
                // Conclusão parcial (pedido do Victor 02/09/2026): item que o
                // montador ainda nem tentou -- diferente de "sem foto" (que
                // seria uma inconsistência, já que foto é obrigatória pra
                // marcar como feito), aqui é esperado não ter foto nenhuma.
                <span className="text-xs font-medium text-gray-400">Ainda não foi feito pelo montador</span>
              )}
            </div>
          );
        })}
      </div>

      <LojaApprovalActions
        requestId={request.id}
        items={request.items.map((i) => ({ id: i.id, product: i.product, quantity: i.quantity, completed: i.completed }))}
      />
    </div>
  );
}
