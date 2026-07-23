import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getCaixaSession } from "@/app/assistencia/caixa-actions";
import { listProdutosEncomenda } from "@/lib/pedidosEncomenda";
import { NovoPedidoEncomendaForm } from "@/components/assistencia/NovoPedidoEncomendaForm";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";

export const dynamic = "force-dynamic";

export default async function SolicitarEncomendaPage({
  searchParams,
}: {
  searchParams: Promise<{ enviado?: string; pedido?: string }>;
}) {
  const { enviado, pedido } = await searchParams;

  const storeId = await getCaixaSession();
  if (!storeId) {
    redirect("/assistencia/encomendas/caixa/login");
  }

  const admin = getSupabaseAdmin();
  const [{ data: store }, produtos] = await Promise.all([
    admin.from("stores").select("name").eq("id", storeId).maybeSingle(),
    listProdutosEncomenda({ onlyActive: true }),
  ]);

  return (
    <div className="max-w-xl mx-auto p-6 flex flex-col gap-6 w-full min-w-0">
      <AssistenciaHeader title="Encomendar produto" subtitle="Pedido direto pro CD/fábrica, sem foto de nota nem WhatsApp." />

      <Link href="/assistencia/encomendas/caixa" className="text-sm underline self-start" style={{ color: "var(--text-secondary)" }}>
        ← Voltar
      </Link>

      {enviado ? (
        <div
          className="rounded-lg border p-4 flex flex-col gap-1"
          style={{ background: "var(--surface-1)", borderColor: "var(--status-good)" }}
        >
          <p className="text-sm font-medium" style={{ color: "var(--status-good)" }}>
            Pedido enviado com sucesso!{pedido ? ` Pedido #${pedido}.` : ""}
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            A fábrica e o CD já enxergam esse pedido na fila deles. Se precisar enviar outro, use o
            formulário abaixo.
          </p>
          <Link
            href="/assistencia/encomendas/caixa"
            className="text-sm underline self-start mt-1"
            style={{ color: "var(--text-secondary)" }}
          >
            Ver meus pedidos
          </Link>
        </div>
      ) : null}

      <NovoPedidoEncomendaForm storeName={store?.name ?? storeId} produtos={produtos} />
    </div>
  );
}
