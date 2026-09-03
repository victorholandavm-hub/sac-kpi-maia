import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/dal";
import { listStores } from "@/lib/serviceRequests";
import { listDrivers } from "@/lib/payments";
import { listCargasRecentes } from "@/lib/cargas";
import { SacCreateRequestForm } from "@/components/assistencia/SacCreateRequestForm";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";

export const dynamic = "force-dynamic";

export default async function SacNovaSolicitacaoPage() {
  const profile = await getProfile();
  if (profile.role !== "sac" && profile.role !== "admin") {
    redirect("/assistencia/inicio");
  }

  const [stores, drivers, cargasRecentes] = await Promise.all([listStores(), listDrivers(), listCargasRecentes()]);
  // Só o código da carga + um resumo curto pra ajudar a reconhecer qual é
  // qual (a tela de criação não precisa da lista de pedidos/problemas por
  // carga, só o "isso existe, escolhe daqui" -- ver Causa raiz no form).
  const cargas = cargasRecentes.map((c) => ({
    carga: c.carga,
    label: `${c.carga}${c.dtPrevisao ? ` — ${c.dtPrevisao}` : ""}${c.motoristaNome ? ` — ${c.motoristaNome}` : ""}`,
  }));

  return (
    // Centralizada, como toda tela de formulário -- pedido do Victor
    // 03/09/2026 ("essa tela precisa estar centralizada, como combinamos,
    // assim como todas as telas de formulário"). Mesmo teto/padrão já usado
    // em encomendas/solicitar/page.tsx (max-w-xl mx-auto) -- bate exatamente
    // com o max-w-xl que o próprio <form> de SacCreateRequestForm.tsx já
    // assume pra si (só que sem mx-auto, ficava desalinhado à esquerda numa
    // página w-full). Essa tela fica fora do grupo (app) -- SAC não tem
    // sessão Supabase Auth, ver requireEncomendaActor -- por isso nunca
    // pegou o teto de largura de lá.
    <div className="max-w-xl mx-auto p-6 flex flex-col gap-6 w-full min-w-0">
      <AssistenciaHeader title="Nova entrega" subtitle="Troca/entrega de produto, envio de peça ou notificação externa.">
        <Link href="/assistencia/sac" className="text-sm font-medium text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-150">
          ← Voltar
        </Link>
      </AssistenciaHeader>

      <Link href="/assistencia/sac/nova-visita" className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors duration-150 self-start">
        Precisa de montagem ou desmontagem? Vá pra Nova visita →
      </Link>
      {/* Recolhimento de PEÇA é domínio da Assistência (ver
          assistenciaLabels.ts) -- único tipo que falta aqui. Só admin
          (supervisão dos dois times) ganha esse atalho, espelhando o de
          /assistencia/nova-entrega (pedido do Victor 19/08/2026). */}
      {profile.role === "admin" ? (
        <Link href="/assistencia/nova-entrega" className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors duration-150 self-start">
          Precisa de recolhimento de peça? Vá pra Nova entrega da Assistência →
        </Link>
      ) : null}

      <SacCreateRequestForm stores={stores} drivers={drivers} cargas={cargas} />
    </div>
  );
}
