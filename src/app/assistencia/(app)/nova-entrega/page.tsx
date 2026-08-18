import Link from "next/link";
import { getProfile, redirectIfSac } from "@/lib/dal";
import { listStores } from "@/lib/serviceRequests";
import { listDrivers } from "@/lib/payments";
import { listCargasRecentes } from "@/lib/cargas";
import { NovaEntregaAssistenciaForm } from "@/components/assistencia/NovaEntregaAssistenciaForm";

export default async function NovaEntregaPage() {
  const profile = await getProfile();
  redirectIfSac(profile);
  const [stores, drivers, cargasRecentes] = await Promise.all([listStores(), listDrivers(), listCargasRecentes()]);
  // Mesmo resumo de sac/nova/page.tsx -- só o código da carga + um resumo
  // curto pra reconhecer qual é qual (ver Quem errou/erro_motorista no form).
  const cargas = cargasRecentes.map((c) => ({
    carga: c.carga,
    label: `${c.carga}${c.dtPrevisao ? ` — ${c.dtPrevisao}` : ""}${c.motoristaNome ? ` — ${c.motoristaNome}` : ""}`,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          Nova entrega
        </h2>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          Recolhimento de peça — vai pelo motorista, na rota. Depois dá pra completar os outros dados na própria
          solicitação.
        </p>
        <Link href="/assistencia/nova-rapida" className="text-sm underline mt-1 inline-block" style={{ color: "var(--text-secondary)" }}>
          Precisa de montagem, desmontagem, troca de peça ou vistoria? Vá pra Nova visita →
        </Link>
      </div>
      <NovaEntregaAssistenciaForm stores={stores} drivers={drivers} cargas={cargas} />
    </div>
  );
}
