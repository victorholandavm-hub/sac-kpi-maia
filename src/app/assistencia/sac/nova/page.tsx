import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/dal";
import { listStores } from "@/lib/serviceRequests";
import { listDrivers } from "@/lib/payments";
import { SacCreateRequestForm } from "@/components/assistencia/SacCreateRequestForm";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";

export const dynamic = "force-dynamic";

export default async function SacNovaSolicitacaoPage() {
  const profile = await getProfile();
  if (profile.role !== "sac" && profile.role !== "admin" && profile.role !== "assistencia") {
    redirect("/assistencia/inicio");
  }

  const [stores, drivers] = await Promise.all([listStores(), listDrivers()]);

  return (
    <div className="max-w-2xl mx-auto p-6 flex flex-col gap-6 w-full min-w-0">
      <AssistenciaHeader title="Nova solicitação" subtitle="Notificação externa ou troca de produto.">
        <Link href="/assistencia/sac" className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
          ← Voltar
        </Link>
      </AssistenciaHeader>

      <SacCreateRequestForm stores={stores} drivers={drivers} />
    </div>
  );
}
