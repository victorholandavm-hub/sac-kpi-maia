import Link from "next/link";
import { getProfile } from "@/lib/dal";
import { getRequestDetail, type ServiceRequestDetail } from "@/lib/serviceRequests";
import { PrintButton } from "@/components/assistencia/PrintButton";
import { DespachoCard } from "@/components/assistencia/DespachoCard";

export const dynamic = "force-dynamic";

// Impressão em lote (pedido do Victor 19/08/2026: "selecione todas as
// notificações de um dia e coloque todas juntas pra impressão") -- mesmo
// cartão de despacho de sempre (ver DespachoCard.tsx), um atrás do outro
// com quebra de página entre cada um, tudo numa impressão só em vez de
// abrir/imprimir uma por uma. Chamada com `?ids=uuid1,uuid2,...` -- ver o
// botão "Imprimir selecionadas" em NotificacoesList.tsx.
export default async function DespachoLotePage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const profile = await getProfile();
  const canView = profile.role === "assistencia" || profile.role === "admin" || profile.role === "sac";
  if (!canView) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Acesso restrito.
      </p>
    );
  }

  const { ids: idsParam } = await searchParams;
  const ids = (idsParam ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (ids.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Nenhuma solicitação selecionada.
      </p>
    );
  }

  const results = await Promise.all(ids.map((id) => getRequestDetail(id)));
  const requests: ServiceRequestDetail[] = results.filter((r) => r !== null).map((r) => r.request);

  return (
    <div className="flex flex-col gap-4 max-w-2xl despacho-print">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link href="/assistencia/fila" className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
          ← Voltar
        </Link>
        <PrintButton requestIds={requests.map((r) => r.id)} />
      </div>

      {requests.length < ids.length ? (
        <p className="text-sm print:hidden" style={{ color: "var(--status-warning)" }}>
          {ids.length - requests.length} solicitação(ões) não encontrada(s) -- só as {requests.length} encontradas entram na
          impressão.
        </p>
      ) : null}

      {/* Mesmo ajuste de @page do despacho individual -- break-after força
          cada cartão pra sua própria folha na impressão (tela mostra tudo
          empilhado com espaço normal entre eles). */}
      <style>{`
        @page { size: A4; margin: 10mm; }
        @media print {
          html, body { height: auto !important; }
          * { print-color-adjust: exact !important; -webkit-print-color-adjust: exact !important; }
        }
        .despacho-lote-item:not(:last-child) { break-after: page; page-break-after: always; }
      `}</style>

      <div className="flex flex-col gap-6">
        {requests.map((request) => (
          <div key={request.id} className="despacho-lote-item">
            <DespachoCard request={request} />
          </div>
        ))}
      </div>
    </div>
  );
}
