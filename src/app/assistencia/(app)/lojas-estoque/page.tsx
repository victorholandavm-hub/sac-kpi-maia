import { redirect } from "next/navigation";
import { getProfile } from "@/lib/dal";
import { ConsultaEstoqueView } from "@/components/ConsultaEstoqueView";
import { OdooTabs } from "@/components/assistencia/OdooTabs";

export const dynamic = "force-dynamic";

// Estoque dos produtos por loja/CD (Odoo) na área da assistência -- Victor
// 26/10/2026. Não é /assistencia/estoque (o estoque de peças da assistência).
export default async function EstoqueLojasPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const profile = await getProfile();
  if (profile.role === "sac") redirect("/assistencia/sac/estoque");
  const { q } = await searchParams;
  return (
    <div className="flex flex-col gap-5 min-w-0">
      <OdooTabs active="estoque" />
      <ConsultaEstoqueView busca={(q ?? "").trim()} acao="/assistencia/lojas-estoque" />
    </div>
  );
}
