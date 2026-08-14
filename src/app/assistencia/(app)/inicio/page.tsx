import Link from "next/link";
import { getProfile, redirectIfSac, canSeeOwnAssemblerStoreRequests } from "@/lib/dal";
import { countRequestsOverview } from "@/lib/serviceRequests";
import { countPartOrdersOverview } from "@/lib/partOrders";
import { countPendingPayments } from "@/lib/payments";
import { countSupplierReturnsOverview } from "@/lib/supplierReturns";
import { OWN_ASSEMBLER_STORE_IDS } from "@/lib/assistenciaLabels";
import { RealtimeQueueRefresher } from "@/components/assistencia/RealtimeQueueRefresher";

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-2xl font-semibold" style={{ color: tone ?? "var(--text-primary)" }}>
        {value}
      </span>
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
    </div>
  );
}

function Card({
  href,
  title,
  description,
  children,
}: {
  href: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border p-5 flex flex-col gap-3 hover:opacity-90"
      style={{ background: "var(--surface-1)", borderColor: "var(--border)", borderTop: "3px solid var(--brand-green)" }}
    >
      <div>
        <h3 className="text-base font-semibold" style={{ color: "var(--brand-green)" }}>
          {title}
        </h3>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
          {description}
        </p>
      </div>
      {children ? <div className="flex flex-wrap gap-5">{children}</div> : null}
    </Link>
  );
}

export default async function InicioPage() {
  const profile = await getProfile();
  redirectIfSac(profile);
  // Ver OWN_ASSEMBLER_STORE_IDS -- mesma exclusão da aba Solicitações.
  const excludeOwnAssemblerStoreIds = canSeeOwnAssemblerStoreRequests(profile) ? undefined : [...OWN_ASSEMBLER_STORE_IDS];
  const [requests, parts, pendingPayments, supplierReturns] = await Promise.all([
    countRequestsOverview(excludeOwnAssemblerStoreIds),
    countPartOrdersOverview(),
    countPendingPayments(),
    countSupplierReturnsOverview(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <RealtimeQueueRefresher />
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        Olá, {profile.fullName.split(" ")[0]}. Aqui está o que precisa da sua atenção agora — tudo o que antes era
        controlado por planilha já é lançado direto aqui.
      </p>

      <div className="grid sm:grid-cols-2 gap-4">
        <Card href="/assistencia/fila" title="Solicitações" description="Montagem, desmontagem, recolhimento, troca de peça, vistoria e notificações.">
          <Stat label="Abertas sem contato" value={requests.openNoContact} tone={requests.openNoContact > 0 ? "var(--status-warning)" : undefined} />
          <Stat label="Aguardando aprovação de prazo" value={requests.pendingDeadline} />
          <Stat label="Concluídas hoje" value={requests.completedToday} tone={requests.completedToday > 0 ? "var(--status-good)" : undefined} />
        </Card>

        <Card href="/assistencia/agenda" title="Agenda" description="Visitas técnicas agendadas na casa do cliente.">
          <Stat label="Agendadas para hoje" value={requests.scheduledToday} />
          <Stat label="Aguardando remarcação" value={requests.needsReschedule} tone={requests.needsReschedule > 0 ? "var(--status-critical)" : undefined} />
        </Card>

        <Card href="/assistencia/pecas" title="Peças" description="Pedidos de peça de reposição junto aos fornecedores.">
          <Stat label="Aguardando chegar" value={parts.awaiting} />
          <Stat label="Prontas para enviar" value={parts.readyToSend} />
        </Card>

        <Card href="/assistencia/fornecedores" title="Fornecedores" description="Remessas de peça defeituosa para conserto/reembolso.">
          <Stat label="Em aberto" value={supplierReturns.open} />
          <Stat label="Atrasadas" value={supplierReturns.overdue} tone={supplierReturns.overdue > 0 ? "var(--status-critical)" : undefined} />
        </Card>

        <Card href="/assistencia/pagamentos" title="Pagamentos" description="Valor por item e liberação de pagamento do montador.">
          <Stat label="Pendentes de liberação" value={pendingPayments} tone={pendingPayments > 0 ? "var(--status-warning)" : undefined} />
        </Card>

        <Card href="/assistencia/estoque" title="Estoque" description="Registrar retiradas, devoluções e reparos no CD." />

        <Card href="/assistencia/encomendas/fila" title="Encomendas" description="Pedido de produto: loja pede, fábrica produz, CD expede." />

        {profile.role === "admin" ? (
          <Card href="/assistencia/admin" title="Administração" description="Contas da equipe, montadores e fornecedores." />
        ) : null}

        {profile.role === "admin" ? (
          <a
            href="https://sac.lojasmaia.com.br"
            className="rounded-lg border p-5 flex flex-col gap-1 hover:opacity-90"
            style={{ background: "var(--surface-1)", borderColor: "var(--border)", borderTop: "3px solid var(--brand-orange)" }}
          >
            <h3 className="text-base font-semibold" style={{ color: "var(--brand-orange)" }}>
              KPIs do SAC ↗
            </h3>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
              Painel de indicadores de atendimento (outro sistema, domínio separado).
            </p>
          </a>
        ) : null}
      </div>
    </div>
  );
}
