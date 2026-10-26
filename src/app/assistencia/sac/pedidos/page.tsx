import { redirect } from "next/navigation";
import { getProfile } from "@/lib/dal";
import { ROLE_LABELS } from "@/lib/assistenciaLabels";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";
import { SacTabs } from "@/components/assistencia/SacTabs";
import { ConsultaPedidoView } from "@/components/ConsultaPedidoView";

export const dynamic = "force-dynamic";

// Consulta de pedido na área do SAC -- mesma tela do painel (/pedidos), com o
// login do atendente (Victor 26/10/2026).
export default async function SacPedidosPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const profile = await getProfile();
  if (profile.role !== "sac" && profile.role !== "admin") {
    redirect("/assistencia/inicio");
  }
  const { q } = await searchParams;

  return (
    <div className="max-w-6xl mx-auto w-full p-6 flex flex-col gap-6 min-w-0">
      <AssistenciaHeader title="Consulta de pedido" subtitle={`${profile.fullName} · ${ROLE_LABELS[profile.role] ?? profile.role}`} />
      <SacTabs active="pedidos" />
      <ConsultaPedidoView busca={(q ?? "").trim()} acao="/assistencia/sac/pedidos" embutida />
    </div>
  );
}
