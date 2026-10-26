import { redirect } from "next/navigation";
import { getProfile } from "@/lib/dal";
import { ConsultaPedidoView } from "@/components/ConsultaPedidoView";

export const dynamic = "force-dynamic";

// Consulta de pedido na área da assistência -- mesma tela do painel
// (/pedidos), com o login de cada um (Victor 26/10/2026). O SAC tem a dele,
// com as abas do SAC (/assistencia/sac/pedidos).
export default async function AssistenciaPedidosPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const profile = await getProfile();
  if (profile.role === "sac") redirect("/assistencia/sac/pedidos");
  const { q } = await searchParams;
  return <ConsultaPedidoView busca={(q ?? "").trim()} acao="/assistencia/pedidos" embutida />;
}
