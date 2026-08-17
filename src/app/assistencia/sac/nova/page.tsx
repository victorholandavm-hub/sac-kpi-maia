import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/dal";
import { listStores } from "@/lib/serviceRequests";
import { listDrivers } from "@/lib/payments";
import { listCargasRecentes } from "@/lib/cargas";
import { getRotaWeekdayConfig, getNextRotaDates, ROTAS, type Rota } from "@/lib/rotas";
import { SacCreateRequestForm } from "@/components/assistencia/SacCreateRequestForm";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";

export const dynamic = "force-dynamic";

export default async function SacNovaSolicitacaoPage() {
  const profile = await getProfile();
  if (profile.role !== "sac" && profile.role !== "admin") {
    redirect("/assistencia/inicio");
  }

  const [stores, drivers, cargasRecentes, rotaConfig] = await Promise.all([
    listStores(),
    listDrivers(),
    listCargasRecentes(),
    getRotaWeekdayConfig(),
  ]);
  // Só o código da carga + um resumo curto pra ajudar a reconhecer qual é
  // qual (a tela de criação não precisa da lista de pedidos/problemas por
  // carga, só o "isso existe, escolhe daqui" -- ver Causa raiz no form).
  const cargas = cargasRecentes.map((c) => ({
    carga: c.carga,
    label: `${c.carga}${c.dtPrevisao ? ` — ${c.dtPrevisao}` : ""}${c.motoristaNome ? ` — ${c.motoristaNome}` : ""}`,
  }));
  // Datas sugeridas por rota (mesmo cálculo de ScheduleField, ver [id]/page.tsx)
  // -- pra já poder escolher rota+data na criação, não só depois editando.
  const nextDatesByRota = Object.fromEntries(ROTAS.map((r) => [r, getNextRotaDates(r, rotaConfig)])) as Record<Rota, string[]>;

  return (
    <div className="max-w-2xl mx-auto p-6 flex flex-col gap-6 w-full min-w-0">
      <AssistenciaHeader title="Nova solicitação" subtitle="Notificação externa ou troca de produto.">
        <Link href="/assistencia/sac" className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
          ← Voltar
        </Link>
      </AssistenciaHeader>

      <SacCreateRequestForm stores={stores} drivers={drivers} cargas={cargas} nextDatesByRota={nextDatesByRota} />
    </div>
  );
}
