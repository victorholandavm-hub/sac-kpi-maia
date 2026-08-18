import Link from "next/link";
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
          Nova visita
        </h2>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          Montagem, desmontagem, troca de peça ou vistoria — cria já com o essencial preenchido. Depois dá pra
          completar os outros dados (CPF, bairro, observações…) na própria solicitação.
        </p>
        <Link href="/assistencia/nova-entrega" className="text-sm underline mt-1 inline-block" style={{ color: "var(--text-secondary)" }}>
          Precisa recolher uma peça? Vá pra Nova entrega →
        </Link>
      </div>
      <QuickCreateRequestForm stores={stores} assemblers={assemblers} includeSacTypes={profile.role === "admin"} />
    </div>
  );
}
