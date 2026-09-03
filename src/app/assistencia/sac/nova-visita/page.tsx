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
    // Centralizada, como toda tela de formulário -- mesmo ajuste/motivo de
    // sac/nova/page.tsx (pedido do Victor 03/09/2026), mesmo par de telas
    // "Nova ___" do SAC.
    <div className="max-w-xl mx-auto p-6 flex flex-col gap-6 w-full min-w-0">
      <AssistenciaHeader title="Nova visita" subtitle="Montagem ou desmontagem — só o intake, a assistência atribui o montador depois.">
        <Link href="/assistencia/sac" className="text-sm font-medium text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-150">
          ← Voltar
        </Link>
      </AssistenciaHeader>

      <Link href="/assistencia/sac/nova" className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors duration-150 self-start">
        Precisa de troca/entrega de produto, envio de peça ou notificação externa? Vá pra Nova entrega →
      </Link>

      <SacNovaVisitaForm stores={stores} />
    </div>
  );
}
