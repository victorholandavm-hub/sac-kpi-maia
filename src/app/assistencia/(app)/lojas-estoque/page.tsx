import { redirect } from "next/navigation";
import { getProfile } from "@/lib/dal";
import { ConsultaEstoqueView } from "@/components/ConsultaEstoqueView";

export const dynamic = "force-dynamic";

// Estoque dos produtos por loja/CD (Odoo) na área da assistência -- Victor
// 26/10/2026. Não é /assistencia/estoque (o estoque de peças da assistência).
export default async function EstoqueLojasPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const profile = await getProfile();
  if (profile.role === "sac") redirect("/assistencia/sac/estoque");
  const { q } = await searchParams;
  return <ConsultaEstoqueView busca={(q ?? "").trim()} acao="/assistencia/lojas-estoque" />;
}
