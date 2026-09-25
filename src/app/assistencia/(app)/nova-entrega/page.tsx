import Link from "next/link";
import { getProfile, redirectIfSac } from "@/lib/dal";
import { listStores } from "@/lib/serviceRequests";
import { listDrivers } from "@/lib/payments";
import { listCargasRecentes } from "@/lib/cargas";
import { NovaEntregaAssistenciaForm } from "@/components/assistencia/NovaEntregaAssistenciaForm";
import { ASSISTENCIA_CAN_CREATE_SAC_TYPES } from "@/lib/assistenciaLabels";

export default async function NovaEntregaPage() {
  const profile = await getProfile();
  redirectIfSac(profile);
  const podeCriarTipoSac = (ASSISTENCIA_CAN_CREATE_SAC_TYPES as readonly string[]).includes(profile.fullName);
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
          Recolhimento ou envio de peça — vai pelo motorista, na rota. Depois dá pra completar os outros dados na
          própria solicitação.
        </p>
        <Link href="/assistencia/nova-rapida" className="text-sm underline mt-1 inline-block" style={{ color: "var(--text-secondary)" }}>
          Precisa de montagem, desmontagem, troca de peça ou vistoria? Vá pra Nova visita →
        </Link>
        {/* Troca/entrega/recolhimento de PRODUTO e notificação externa são
            domínio do SAC (ver assistenciaLabels.ts) -- só admin tem
            supervisão dos dois times, então só admin ganha esse atalho pra
            não fazer todo mundo pensar que devia estar preenchendo isso
            aqui (pedido do Victor 19/08/2026: "como admin preciso poder
            fazer tudo"). Luis e Iasmyn também ganham o atalho a partir de
            25/09/2026 (pedido do Victor) -- mas só pra criar troca/entrega/
            recolhimento de produto, não notificação externa (sac/nova/page.tsx
            já restringe o dropdown de lá aos 3 tipos certos pra eles). */}
        {profile.role === "admin" || podeCriarTipoSac ? (
          <Link href="/assistencia/sac/nova" className="text-sm underline mt-1 inline-block" style={{ color: "var(--text-secondary)" }}>
            Precisa de troca/entrega de produto{profile.role === "admin" ? " ou notificação externa" : ""}? Vá pra Nova entrega do SAC →
          </Link>
        ) : null}
      </div>
      <NovaEntregaAssistenciaForm stores={stores} drivers={drivers} cargas={cargas} />
    </div>
  );
}
