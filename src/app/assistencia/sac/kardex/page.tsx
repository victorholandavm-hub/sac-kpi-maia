import { redirect } from "next/navigation";
import { getProfile } from "@/lib/dal";
import { ROLE_LABELS } from "@/lib/assistenciaLabels";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";
import { SacTabs } from "@/components/assistencia/SacTabs";
import { KardexView, type KardexBusca } from "@/components/odoo/KardexView";

export const dynamic = "force-dynamic";

// Kardex do Odoo só leitura na área do SAC -- Victor 27/10/2026.
export default async function SacKardexPage({ searchParams }: { searchParams: Promise<KardexBusca> }) {
  const profile = await getProfile();
  if (profile.role !== "sac" && profile.role !== "admin") redirect("/assistencia/inicio");
  const sp = await searchParams;
  return (
    <div className="max-w-6xl mx-auto w-full p-6 flex flex-col gap-6 min-w-0">
      <AssistenciaHeader title="Kardex" subtitle={`${profile.fullName} · ${ROLE_LABELS[profile.role] ?? profile.role}`} />
      <SacTabs active="kardex" />
      <KardexView sp={sp} acao="/assistencia/sac/kardex" />
    </div>
  );
}
