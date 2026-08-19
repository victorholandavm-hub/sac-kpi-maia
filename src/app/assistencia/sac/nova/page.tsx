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
    <div className="max-w-2xl mx-auto p-6 flex flex-col gap-6 w-full min-w-0">
      <AssistenciaHeader title="Nova entrega" subtitle="Troca/entrega de produto, envio de peça ou notificação externa.">
        <Link href="/assistencia/sac" className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
          ← Voltar
        </Link>
      </AssistenciaHeader>

      <Link href="/assistencia/sac/nova-visita" className="text-sm underline self-start" style={{ color: "var(--text-secondary)" }}>
        Precisa de montagem ou desmontagem? Vá pra Nova visita →
      </Link>
      {/* Recolhimento de PEÇA é domínio da Assistência (ver
          assistenciaLabels.ts) -- único tipo que falta aqui. Só admin
          (supervisão dos dois times) ganha esse atalho, espelhando o de
          /assistencia/nova-entrega (pedido do Victor 19/08/2026). */}
      {profile.role === "admin" ? (
        <Link href="/assistencia/nova-entrega" className="text-sm underline self-start" style={{ color: "var(--text-secondary)" }}>
          Precisa de recolhimento de peça? Vá pra Nova entrega da Assistência →
        </Link>
      ) : null}

      <SacCreateRequestForm stores={stores} drivers={drivers} cargas={cargas} />
    </div>
  );
}
