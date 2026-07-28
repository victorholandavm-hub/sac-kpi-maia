import Link from "next/link";
import { requireFornecedorPedidoActor } from "@/lib/fornecedorPedidoAuth";
import { listSuppliers } from "@/lib/partOrders";
import { NovoPedidoFornecedorForm } from "@/components/assistencia/NovoPedidoFornecedorForm";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";

export const dynamic = "force-dynamic";

export default async function NovoPedidoFornecedorPage() {
  await requireFornecedorPedidoActor();
  const suppliers = await listSuppliers();

  return (
    <div className="max-w-xl mx-auto p-6 flex flex-col gap-6 w-full min-w-0">
      <AssistenciaHeader title="Novo pedido a fornecedor" subtitle="Reposição de estoque comprada de fábrica/fornecedor externo." />

      <Link href="/assistencia/encomendas/fornecedores" className="text-sm underline self-start" style={{ color: "var(--text-secondary)" }}>
        ← Voltar
      </Link>

      <NovoPedidoFornecedorForm suppliers={suppliers} />
    </div>
  );
}
