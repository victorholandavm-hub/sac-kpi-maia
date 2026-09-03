import Link from "next/link";
import { getProfile, redirectIfSac, canSeeOwnAssemblerStoreRequests } from "@/lib/dal";
import { countRequestsOverview } from "@/lib/serviceRequests";
import { countPartOrdersOverview } from "@/lib/partOrders";
import { countPendingPayments } from "@/lib/payments";
import { countSupplierReturnsOverview } from "@/lib/supplierReturns";
import { OWN_ASSEMBLER_STORE_IDS } from "@/lib/assistenciaLabels";
import { RealtimeQueueRefresher } from "@/components/assistencia/RealtimeQueueRefresher";

// Número simples (sem borda própria, embutido dentro do Card) -- fica
// sempre neutro/preto, mesmo quando precisa de atenção: em vez de colorir
// o número inteiro (Tier 0/1 antigo), uma bolinha discreta ao lado sinaliza
// "precisa de atenção" sem virar texto colorido (Guia de Componentes Maia,
// mesma régua de StatusBadge/CountBadge -- cor no indicador, não no texto).
function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-1.5">
        {value}
        {warn && value > 0 ? <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: "var(--status-warning)" }} aria-hidden /> : null}
      </span>
      <span className="text-xs text-gray-400 dark:text-gray-500">{label}</span>
    </div>
  );
}

// Cartão branco/borda fina/shadow-sm -- Guia de Componentes Maia (Design
// System, 01/09/2026), mesmo padrão do resto do SAC. Substitui o Tier 0
// antigo daqui (rounded-lg border cinza + título colorido) -- achado
// revisando as telas 02/09/2026: era a pior tela fora desse padrão, a
// primeira que qualquer gerente/assistência vê depois do login.
function Card({
  href,
  title,
  description,
  accent,
  children,
}: {
  href: string;
  title: string;
  description: string;
  // Faixa fina na borda esquerda -- única "cor" que sobra por card, só pra
  // diferenciar visualmente sem colorir texto nenhum (ex.: KPIs do SAC,
  // sistema/domínio separado). Omitido = card neutro igual aos outros.
  accent?: string;
  children?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-sm p-5 flex flex-col gap-3 hover:border-gray-300 dark:hover:border-gray-500 transition-colors duration-150"
      style={accent ? { borderLeft: `3px solid ${accent}` } : undefined}
    >
      <div>
        <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">{title}</h3>
        <p className="text-sm mt-0.5 text-gray-400 dark:text-gray-500">{description}</p>
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

      {/* sm:grid-cols-2 -- lg:grid-cols-3/xl:grid-cols-4 aproveitam a
          largura total que o layout ganhou (pedido do Victor 31/08/2026);
          sem esses breakpoints extras os cards ficariam com espaço vazio
          enorme dos dois lados numa tela de desktop. */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <Card href="/assistencia/fila" title="Solicitações" description="Montagem, desmontagem, recolhimento, troca de peça, vistoria e notificações.">
          <Stat label="Abertas sem contato" value={requests.openNoContact} warn />
          <Stat label="Aguardando aprovação de prazo" value={requests.pendingDeadline} />
          <Stat label="Concluídas hoje" value={requests.completedToday} />
        </Card>

        <Card href="/assistencia/agenda" title="Agenda" description="Visitas técnicas agendadas na casa do cliente.">
          <Stat label="Agendadas para hoje" value={requests.scheduledToday} />
          <Stat label="Aguardando remarcação" value={requests.needsReschedule} warn />
        </Card>

        <Card href="/assistencia/pecas" title="Peças" description="Pedidos de peça de reposição junto aos fornecedores.">
          <Stat label="Aguardando chegar" value={parts.awaiting} />
          <Stat label="Prontas para enviar" value={parts.readyToSend} />
        </Card>

        <Card href="/assistencia/fornecedores" title="Fornecedores" description="Remessas de peça defeituosa para conserto/reembolso.">
          <Stat label="Em aberto" value={supplierReturns.open} />
          <Stat label="Atrasadas" value={supplierReturns.overdue} warn />
        </Card>

        <Card href="/assistencia/pagamentos" title="Pagamentos" description="Valor por item e liberação de pagamento do montador.">
          <Stat label="Pendentes de liberação" value={pendingPayments} warn />
        </Card>

        <Card href="/assistencia/estoque" title="Estoque" description="Registrar retiradas, devoluções e reparos no CD." />

        <Card href="/assistencia/encomendas/fila" title="Encomendas" description="Pedido de produto: loja pede, fábrica produz, CD expede." />

        {profile.role === "admin" ? (
          <Card href="/assistencia/admin" title="Administração" description="Contas da equipe, montadores e fornecedores." />
        ) : null}

        {profile.role === "admin" ? (
          <Card
            href="https://sac.lojasmaia.com.br"
            title="KPIs do SAC ↗"
            description="Painel de indicadores de atendimento (outro sistema, domínio separado)."
            accent="var(--brand-orange)"
          />
        ) : null}
      </div>
    </div>
  );
}
