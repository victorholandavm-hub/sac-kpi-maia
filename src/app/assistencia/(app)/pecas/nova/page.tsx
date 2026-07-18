import { getProfile } from "@/lib/dal";
import { listSuppliers } from "@/lib/partOrders";
import { getRequestDetail } from "@/lib/serviceRequests";
import { NewPartOrderForm } from "@/components/assistencia/NewPartOrderForm";

export default async function NovoPedidoPecaPage({
  searchParams,
}: {
  searchParams: Promise<{ service_request_id?: string }>;
}) {
  await getProfile();
  const { service_request_id } = await searchParams;
  const suppliers = await listSuppliers();

  let defaultValues: {
    serviceRequestId?: string;
    clientName?: string;
    clientCpf?: string;
    clientPhone?: string;
    product?: string;
  } = {};

  if (service_request_id) {
    const result = await getRequestDetail(service_request_id);
    if (result) {
      defaultValues = {
        serviceRequestId: result.request.id,
        clientName: result.request.clientName ?? undefined,
        clientCpf: result.request.clientCpf ?? undefined,
        clientPhone: result.request.clientPhone ?? undefined,
        product: result.request.items[0]?.product,
      };
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
        Novo pedido de peça
      </h2>
      <NewPartOrderForm suppliers={suppliers} defaultValues={defaultValues} />
    </div>
  );
}
