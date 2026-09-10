import Link from "next/link";
import { getProfile, redirectIfSac } from "@/lib/dal";
import { getPartOrder } from "@/lib/partOrders";
import { PartOrderDespachoCard } from "@/components/assistencia/PartOrderDespachoCard";
import { SimplePrintButton } from "@/components/assistencia/SimplePrintButton";

// Impressão do pedido de peça -- pedido do Victor 10/09/2026: "preciso que
// cada solicitação dessa possa ser impressa igual o despacho das
// notificações de assistencia". Mesmo esqueleto de [id]/despacho/page.tsx
// (chamados), sem o controle de "já impressa" (não foi pedido aqui, nem
// existe registro de evento pra pedido de peça).
export default async function PartOrderDespachoPage({ params }: { params: Promise<{ id: string }> }) {
  redirectIfSac(await getProfile());
  const { id } = await params;
  const order = await getPartOrder(id);

  if (!order) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Pedido de peça não encontrado.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4 max-w-2xl print:max-w-none despacho-print">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link href={`/assistencia/pecas/${order.id}`} className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
          ← Ver pedido completo
        </Link>
        <SimplePrintButton />
      </div>

      {/* Mesmo ajuste de @page do despacho de chamados (ver
          [id]/despacho/page.tsx). */}
      <style>{`
        @page { size: A4; margin: 10mm; }
        @media print {
          html, body { height: auto !important; }
          * { print-color-adjust: exact !important; -webkit-print-color-adjust: exact !important; }
          .despacho-print { width: 100% !important; max-width: 100% !important; }
        }
      `}</style>

      <PartOrderDespachoCard order={order} />
    </div>
  );
}
