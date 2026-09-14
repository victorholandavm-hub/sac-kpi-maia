import { redirect } from "next/navigation";
import Link from "next/link";
import { getTecnicoSession } from "@/app/assistencia/tecnico-actions";
import { getPartOrder } from "@/lib/partOrders";
import { PartOrderDespachoCard } from "@/components/assistencia/PartOrderDespachoCard";
import { SimplePrintButton } from "@/components/assistencia/SimplePrintButton";

export const dynamic = "force-dynamic";

// Impressão do pedido de peça, versão da equipe técnica -- mesmo cartão de
// [id]/despacho/page.tsx (assistência/admin), só sem o cabeçalho/abas
// (tela de impressão não precisa de navegação, mesmo padrão da versão
// original). Duplicado em vez de compartilhado -- arquivo pequeno, e as
// duas rotas (/assistencia/pecas e /assistencia/tecnico/pecas) ficam
// completamente independentes uma da outra desde 14/09/2026.
export default async function TecnicoPecaDespachoPage({ params }: { params: Promise<{ id: string }> }) {
  const tecnicoName = await getTecnicoSession();
  if (!tecnicoName) {
    redirect("/assistencia/tecnico/login");
  }
  const { id } = await params;
  const order = await getPartOrder(id);

  if (!order) {
    return (
      <p className="text-sm p-6" style={{ color: "var(--text-muted)" }}>
        Pedido de peça não encontrado.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4 max-w-2xl print:max-w-none despacho-print p-6">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link href={`/assistencia/tecnico/pecas/${order.id}`} className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
          ← Ver pedido completo
        </Link>
        <SimplePrintButton />
      </div>

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
