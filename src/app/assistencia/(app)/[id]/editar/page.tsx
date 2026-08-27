import { getProfile } from "@/lib/dal";
import { getRequestDetail, listStores } from "@/lib/serviceRequests";
import { EditRequestForm } from "@/components/assistencia/EditRequestForm";
import { SAC_MANAGED_TYPES, SAC_ALSO_MANAGED_TYPES, manageableTypesForRole } from "@/lib/assistenciaLabels";

export default async function EditRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getProfile();

  const result = await getRequestDetail(id);
  if (!result) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Solicitação não encontrada.
      </p>
    );
  }

  // SAC_ALSO_MANAGED_TYPES (envio_peca/recolhimento) -- pedido do Victor
  // 27/08/2026, ver comentário em assistenciaLabels.ts.
  const canEdit =
    profile.role === "assistencia" ||
    profile.role === "admin" ||
    (profile.role === "sac" &&
      ((SAC_MANAGED_TYPES as readonly string[]).includes(result.request.type) ||
        (SAC_ALSO_MANAGED_TYPES as readonly string[]).includes(result.request.type)));
  if (!canEdit) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Acesso restrito.
      </p>
    );
  }

  const stores = await listStores();
  const editableTypes = manageableTypesForRole(profile.role);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
        Corrigir solicitação
      </h2>
      <EditRequestForm request={result.request} stores={stores} editableTypes={editableTypes} />
    </div>
  );
}
