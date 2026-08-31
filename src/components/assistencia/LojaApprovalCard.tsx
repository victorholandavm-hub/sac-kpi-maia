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
    <div className="flex flex-col gap-3 p-4" style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)", borderRadius: 12 }}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-mono font-semibold" style={{ color: "var(--text-secondary)" }}>
          #{request.ticketNumber}
        </span>
        <StatusBadge status={request.status} showInfo />
        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {REQUEST_TYPE_LABELS[request.type] ?? request.type}
        </span>
        <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          · {request.storeName}
        </span>
      </div>

      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
        {request.clientName ?? "Sem nome de cliente"}
      </p>
      {request.assemblerName ? (
        <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          Montador: {request.assemblerName}
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        {request.items.map((item) => {
          const itemPhotos = photos.filter((p) => p.itemId === item.id);
          return (
            <div key={item.id} className="flex flex-col gap-1.5 pb-3" style={{ borderBottom: "1px solid var(--gridline)" }}>
              <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                {item.quantity > 1 ? `${item.quantity}x ` : ""}
                {item.product}
              </span>
              {itemPhotos.length > 0 ? (
                <PhotoGallery photos={itemPhotos} />
              ) : (
                <span className="text-xs font-medium" style={{ color: "var(--status-warning)" }}>
                  Sem foto enviada
                </span>
              )}
            </div>
          );
        })}
      </div>

      <LojaApprovalActions
        requestId={request.id}
        items={request.items.map((i) => ({ id: i.id, product: i.product, quantity: i.quantity }))}
      />
    </div>
  );
}
