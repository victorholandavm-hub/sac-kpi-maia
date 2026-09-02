import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/dal";
import { listStores } from "@/lib/serviceRequests";
import { SacNovaVisitaForm } from "@/components/assistencia/SacNovaVisitaForm";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";

export const dynamic = "force-dynamic";

export default async function SacNovaVisitaPage() {
  const profile = await getProfile();
  if (profile.role !== "sac" && profile.role !== "admin") {
    redirect("/assistencia/inicio");
  }

  const stores = await listStores();

  return (
    <div className="w-full p-6 flex flex-col gap-6 min-w-0">
      <AssistenciaHeader title="Nova visita" subtitle="Montagem ou desmontagem — só o intake, a assistência atribui o montador depois.">
        <Link href="/assistencia/sac" className="text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors duration-150">
          ← Voltar
        </Link>
      </AssistenciaHeader>

      <Link href="/assistencia/sac/nova" className="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors duration-150 self-start">
        Precisa de troca/entrega de produto, envio de peça ou notificação externa? Vá pra Nova entrega →
      </Link>

      <SacNovaVisitaForm stores={stores} />
    </div>
  );
}
