import { redirect } from "next/navigation";
import { getProfile } from "@/lib/dal";
import { ROLE_LABELS } from "@/lib/assistenciaLabels";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";
import { SacTabs } from "@/components/assistencia/SacTabs";
import { ToastProvider } from "@/components/assistencia/ToastProvider";
import { ExpedicaoFila } from "@/components/logisticaOdoo/ExpedicaoFila";

export const dynamic = "force-dynamic";

// Expedição do Odoo na área do SAC -- Victor 27/10/2026 (só leitura), 29/10:
// a mesma fila do CD ao vivo, com as observações e as ações por entrega
// (pendência, data programada, filial, anotação, histórico e "Nota de
// entrega" = faturar a 5117 e dar baixa). Montar carga continua só no CD.
export default async function SacExpedicaoPage({ searchParams }: { searchParams: Promise<{ empresa?: string }> }) {
  const profile = await getProfile();
  if (profile.role !== "sac" && profile.role !== "admin") redirect("/assistencia/inicio");
  return (
    <ToastProvider>
      <div className="w-full max-w-[1600px] mx-auto p-6 flex flex-col gap-6 min-w-0">
        <AssistenciaHeader title="Expedição" subtitle={`${profile.fullName} · ${ROLE_LABELS[profile.role] ?? profile.role}`} />
        <SacTabs active="expedicao" />
        <ExpedicaoFila sp={await searchParams} sac />
      </div>
    </ToastProvider>
  );
}
