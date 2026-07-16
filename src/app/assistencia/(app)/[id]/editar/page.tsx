import { getProfile } from "@/lib/dal";
import { getRequestDetail, listStores } from "@/lib/serviceRequests";
import { EditRequestForm } from "@/components/assistencia/EditRequestForm";

export default async function EditRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getProfile();

  if (profile.role !== "assistencia" && profile.role !== "admin") {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Acesso restrito.
      </p>
    );
  }

  const result = await getRequestDetail(profile, id);
  if (!result) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Solicitação não encontrada.
      </p>
    );
  }

  const stores = await listStores();

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
        Corrigir solicitação
      </h2>
      <EditRequestForm request={result.request} stores={stores} />
    </div>
  );
}
