import { redirect } from "next/navigation";
import { getProfile } from "@/lib/dal";
import { OdooTabs } from "@/components/assistencia/OdooTabs";
import { ExpedicaoLeituraView, type ExpedicaoBusca } from "@/components/odoo/ExpedicaoLeituraView";

export const dynamic = "force-dynamic";

// Expedição do Odoo só leitura na aba Odoo da assistência -- Victor 27/10/2026.
export default async function OdooExpedicaoPage({ searchParams }: { searchParams: Promise<ExpedicaoBusca> }) {
  const profile = await getProfile();
  if (profile.role === "sac") redirect("/assistencia/sac/expedicao");
  const sp = await searchParams;
  return (
    <div className="flex flex-col gap-5 min-w-0">
      <OdooTabs active="expedicao" />
      <ExpedicaoLeituraView sp={sp} acao="/assistencia/odoo-expedicao" consulta="/assistencia/pedidos" />
    </div>
  );
}
