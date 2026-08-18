import { getProfile, redirectIfSac } from "@/lib/dal";
import { listStores } from "@/lib/serviceRequests";
import { listAllAssemblersWithStoreId, listDrivers } from "@/lib/payments";
import { listCargasRecentes } from "@/lib/cargas";
import { QuickCreateRequestForm } from "@/components/assistencia/QuickCreateRequestForm";

export default async function NovaRapidaPage() {
  const profile = await getProfile();
  redirectIfSac(profile);
  const [stores, assemblers, drivers, cargasRecentes] = await Promise.all([
    listStores(),
    listAllAssemblersWithStoreId(),
    listDrivers(),
    listCargasRecentes(),
  ]);
  // Mesmo resumo de sac/nova/page.tsx -- só o código da carga + um resumo
  // curto pra reconhecer qual é qual (ver Quem errou/erro_motorista no form,
  // agora que Recolhimento de peça também usa causa raiz).
  const cargas = cargasRecentes.map((c) => ({
    carga: c.carga,
    label: `${c.carga}${c.dtPrevisao ? ` — ${c.dtPrevisao}` : ""}${c.motoristaNome ? ` — ${c.motoristaNome}` : ""}`,
  }));

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
      <QuickCreateRequestForm
        stores={stores}
        assemblers={assemblers}
        drivers={drivers}
        cargas={cargas}
        includeSacTypes={profile.role === "admin"}
      />
    </div>
  );
}
