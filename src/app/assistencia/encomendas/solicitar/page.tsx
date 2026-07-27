import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveEncomendaRequester } from "@/lib/encomendaRequester";
import { listVendedoresWithPinStatus } from "@/lib/vendedores";
import { NovoPedidoEncomendaForm } from "@/components/assistencia/NovoPedidoEncomendaForm";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";

export const dynamic = "force-dynamic";

export default async function SolicitarEncomendaPage({
  searchParams,
}: {
  searchParams: Promise<{ enviado?: string; pedido?: string }>;
}) {
  const { enviado, pedido } = await searchParams;

  const requester = await resolveEncomendaRequester();
  if (!requester) {
    redirect("/assistencia/encomendas");
  }

  const admin = getSupabaseAdmin();
  const vendedores = await listVendedoresWithPinStatus();

  const isCdOrFabrica = requester.kind === "cd" || requester.kind === "fabrica";

  let fixedStoreName: string | undefined;
  let storeOptions: { id: string; name: string }[] | undefined;

  if (isCdOrFabrica) {
    const { data } = await admin.from("stores").select("id, name").order("name");
    storeOptions = data ?? [];
  } else if (requester.kind === "gerente" && requester.storeIds.length > 1) {
    const { data } = await admin.from("stores").select("id, name").in("id", requester.storeIds).order("name");
    storeOptions = data ?? [];
  } else {
    const storeId = requester.kind === "gerente" ? requester.storeIds[0] : requester.storeId;
    const { data: store } = await admin.from("stores").select("name").eq("id", storeId).maybeSingle();
    fixedStoreName = store?.name ?? storeId;
  }

  const voltarHref = isCdOrFabrica ? "/assistencia/encomendas/fila" : "/assistencia/encomendas/caixa";

  return (
    <div className="max-w-xl mx-auto p-6 flex flex-col gap-6 w-full min-w-0">
      <AssistenciaHeader title="Encomendar produto" subtitle="Pedido direto pro CD/fábrica, sem foto de nota nem WhatsApp." />

      <Link href={voltarHref} className="text-sm underline self-start" style={{ color: "var(--text-secondary)" }}>
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
            href={voltarHref}
            className="text-sm underline self-start mt-1"
            style={{ color: "var(--text-secondary)" }}
          >
            Ver meus pedidos
          </Link>
        </div>
      ) : null}

      <NovoPedidoEncomendaForm
        requester={requester}
        fixedStoreName={fixedStoreName}
        storeOptions={storeOptions}
        vendedorNames={vendedores.map((v) => v.name)}
      />
    </div>
  );
}
