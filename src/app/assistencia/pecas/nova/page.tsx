import { listSuppliers, listSupplierContacts } from "@/lib/partOrders";
import { getRequestDetail } from "@/lib/serviceRequests";
import { NewPartOrderForm } from "@/components/assistencia/NewPartOrderForm";

// Acesso (Profile assistência/admin OU equipe técnica) já garantido pelo
// layout (pecas/layout.tsx, ver pecasAccess.ts) -- nada a checar aqui.
export default async function NovoPedidoPecaPage({
  searchParams,
}: {
  searchParams: Promise<{ service_request_id?: string; client_name?: string; client_cpf?: string; client_phone?: string; product?: string }>;
}) {
  const { service_request_id, client_name, client_cpf, client_phone, product } = await searchParams;
  const [suppliers, supplierContacts] = await Promise.all([listSuppliers(), listSupplierContacts()]);

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
  } else if (client_name || client_cpf || client_phone || product) {
    // Vindo do detalhe de um cadastro (Cadastros) -- não existe chamado de
    // verdade ainda, só os dados do cliente/produto pra pré-preencher.
    defaultValues = {
      clientName: client_name || undefined,
      clientCpf: client_cpf || undefined,
      clientPhone: client_phone || undefined,
      product: product || undefined,
    };
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
        Novo pedido de peça
      </h2>
      <NewPartOrderForm suppliers={suppliers} supplierContacts={supplierContacts} defaultValues={defaultValues} />
    </div>
  );
}
