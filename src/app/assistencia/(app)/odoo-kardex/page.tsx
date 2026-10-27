import { redirect } from "next/navigation";
import { getProfile } from "@/lib/dal";
import { OdooTabs } from "@/components/assistencia/OdooTabs";
import { KardexView, type KardexBusca } from "@/components/odoo/KardexView";

export const dynamic = "force-dynamic";

// Kardex do Odoo só leitura na aba Odoo da assistência -- Victor 27/10/2026.
export default async function OdooKardexPage({ searchParams }: { searchParams: Promise<KardexBusca> }) {
  const profile = await getProfile();
  if (profile.role === "sac") redirect("/assistencia/sac/kardex");
  const sp = await searchParams;
  return (
    <div className="flex flex-col gap-5 min-w-0">
      <OdooTabs active="kardex" />
      <KardexView sp={sp} acao="/assistencia/odoo-kardex" />
    </div>
  );
}
