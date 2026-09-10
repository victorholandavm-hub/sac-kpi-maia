import Link from "next/link";
import { getProfile, redirectIfSac } from "@/lib/dal";
import { getPartOrder } from "@/lib/partOrders";
import { PART_ORDER_STATUS_LABELS, PART_ORDER_STATUS_COLORS } from "@/lib/assistenciaLabels";
import { PartOrderActions } from "@/components/assistencia/PartOrderActions";
import { ExpectedAtField } from "@/components/assistencia/ExpectedAtField";
import { PartOrderEmailButton } from "@/components/assistencia/PartOrderEmailButton";
import { formatDateTimeBr } from "@/lib/formatDateTime";

// Redesenho pedido do Victor 10/09/2026 ("refatorar e modernizar... mais
// profissional, limpa e altamente legível") -- mesma tela, mesmos dados,
// reorganizada em blocos + contraste mais alto. Segue o padrão Tailwind
// gray-*/dark: já usado no resto do módulo peças construído nesta sessão
// (PecasTable.tsx, pecas/page.tsx) em vez dos tokens var(--*) que essa
// tela ainda usava -- consistência dentro do próprio módulo, não porque
// var(--*) seja pior (é o mesmo sistema de cor por trás, só outra forma
// de aplicar).
function StatusBadge({ status }: { status: string }) {
  const color = PART_ORDER_STATUS_COLORS[status] ?? "var(--text-muted)";
  return (
    <span
      className="inline-flex items-center gap-2 text-sm font-bold px-3 py-1 rounded-full whitespace-nowrap"
      style={{ color: "var(--text-primary)", background: `color-mix(in srgb, ${color} 35%, var(--surface-1))` }}
    >
      <span className="inline-block w-2 h-2 rounded-full" style={{ background: color }} />
      {PART_ORDER_STATUS_LABELS[status] ?? status}
    </span>
  );
}

// Rótulo em contraste mais alto (text-gray-500, não mais o antigo
// text-gray-400) + dado em font-medium -- pedido do Victor 10/09/2026,
// item 1 ("Acessibilidade e contraste").
function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{value}</span>
    </div>
  );
}

// Bloco/cartão visual -- pedido do Victor 10/09/2026, item 2: "3 ou 4
// blocos/cards visuais distintos". 4 aqui: Peça, Cliente, Pedido/Logística
// e Andamento (esse último só quando tem alguma data de andamento pra
// mostrar -- pedido criado agora não tem "peça chegou em" ainda, por
// exemplo).
function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-6 shadow-sm flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      <div className="grid sm:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

export default async function PartOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  redirectIfSac(await getProfile());
  const { id } = await params;
  const order = await getPartOrder(id);

  if (!order) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Pedido de peça não encontrado.</p>;
  }

  const hasAndamento = order.partArrivedAt || order.sentToClientAt || order.closedAt || order.serviceRequestId;

  return (
    <div className="flex flex-col gap-4">
      {/* Cabeçalho destacado -- ID, título, status e ações globais num
          bloco só, separado do resto por uma borda inferior (pedido do
          Victor 10/09/2026, item 2). */}
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl px-6 py-5 shadow-sm flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex flex-col gap-1.5 min-w-0">
            <span className="text-xs font-mono font-medium text-gray-500 dark:text-gray-400">
              {order.externalReference ?? `Chamado #${order.ticketNumber}`}
            </span>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 truncate">{order.partName}</h2>
            <div>
              <StatusBadge status={order.status} />
            </div>
          </div>
          {/* Ações globais como botões reais, não mais links sublinhados --
              pedido do Victor 10/09/2026, item 3. */}
          <div className="flex items-center gap-2 shrink-0">
            <PartOrderEmailButton o={order} />
            <Link
              href={`/assistencia/pecas/${order.id}/despacho`}
              className="text-sm font-semibold px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-500 transition-colors duration-150"
            >
              Imprimir
            </Link>
            <Link
              href={`/assistencia/pecas/${order.id}/editar`}
              className="text-sm font-semibold px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-500 transition-colors duration-150"
            >
              Editar
            </Link>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Block title="Peça / Produto">
          <Field label="Código da peça" value={order.partCode} />
          <Field label="Cor" value={order.color} />
          <Field label="Fornecedor" value={order.supplier} />
          <div className="sm:col-span-2">
            <Field label="Produto do cliente" value={order.product} />
          </div>
        </Block>

        <Block title="Cliente">
          <div className="sm:col-span-2">
            <Field label="Nome" value={order.clientName} />
          </div>
          <Field label="CPF" value={order.clientCpf} />
          <Field label="Telefone" value={order.clientPhone} />
          <Field label="E-mail" value={order.clientEmail} />
        </Block>

        <Block title="Pedido / Logística">
          <Field label="Representante" value={order.representative} />
          <Field label="E-mail do representante" value={order.representativeEmail} />
          <Field label="Telefone do representante" value={order.representativePhone} />
          <Field label="Pedido por" value={order.requestedBy} />
          <Field label="Criado em" value={formatDateTimeBr(order.createdAt)} />
          <ExpectedAtField orderId={order.id} expectedAt={order.expectedAt} />
        </Block>

        {hasAndamento ? (
          <Block title="Andamento">
            <Field label="Peça chegou em" value={order.partArrivedAt ? new Date(order.partArrivedAt).toLocaleDateString("pt-BR") : null} />
            <Field
              label="Enviada ao cliente em"
              value={order.sentToClientAt ? new Date(order.sentToClientAt).toLocaleDateString("pt-BR") : null}
            />
            <Field label="Encerrado em" value={order.closedAt ? new Date(order.closedAt).toLocaleDateString("pt-BR") : null} />
            {order.serviceRequestId ? (
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Solicitação vinculada</span>
                <Link
                  href={`/assistencia/${order.serviceRequestId}`}
                  className="text-sm font-medium underline text-gray-900 dark:text-gray-100 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  Ver solicitação
                </Link>
              </div>
            ) : null}
          </Block>
        ) : null}
      </div>

      <PartOrderActions orderId={order.id} status={order.status} notes={order.notes} />
    </div>
  );
}
