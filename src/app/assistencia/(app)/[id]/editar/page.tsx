import { getProfile } from "@/lib/dal";
import { getRequestDetail, listStores } from "@/lib/serviceRequests";
import { listDrivers } from "@/lib/payments";
import { listCargasRecentes } from "@/lib/cargas";
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

  // Motorista/carga só entram na busca quando fazem sentido pra editar --
  // pedido do Victor 29/08/2026: "hoje nao consigo alterar a carga e o
  // motorista que errou". Mesmas listas que a criação usa (SacCreateRequestForm.tsx,
  // via /assistencia/sac/nova) -- carga com resumo curto (data+motorista)
  // pra reconhecer qual é qual no datalist.
  const [stores, drivers, cargasRecentes] = await Promise.all([listStores(), listDrivers(), listCargasRecentes()]);
  const cargas = cargasRecentes.map((c) => ({
    carga: c.carga,
    label: `${c.carga}${c.dtPrevisao ? ` — ${c.dtPrevisao}` : ""}${c.motoristaNome ? ` — ${c.motoristaNome}` : ""}`,
  }));
  const editableTypes = manageableTypesForRole(profile.role);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
        Corrigir solicitação
      </h2>
      <EditRequestForm request={result.request} stores={stores} editableTypes={editableTypes} drivers={drivers} cargas={cargas} />
    </div>
  );
}
