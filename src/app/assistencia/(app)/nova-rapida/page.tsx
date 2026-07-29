import { getProfile, redirectIfSac } from "@/lib/dal";
import { listStores } from "@/lib/serviceRequests";
import { listAllAssemblersWithStoreId } from "@/lib/payments";
import { QuickCreateRequestForm } from "@/components/assistencia/QuickCreateRequestForm";

export default async function NovaRapidaPage() {
  const profile = await getProfile();
  redirectIfSac(profile);
  const [stores, assemblers] = await Promise.all([listStores(), listAllAssemblersWithStoreId()]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          Criação rápida
        </h2>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          Cria uma solicitação já com o essencial preenchido — útil pra uma visita ou um pagamento avulso, sem
          passar pela tela completa. Depois dá pra completar os outros dados (CPF, bairro, observações…) na própria
          solicitação.
        </p>
      </div>
      <QuickCreateRequestForm stores={stores} assemblers={assemblers} includeSacTypes={profile.role === "admin"} />
    </div>
  );
}
