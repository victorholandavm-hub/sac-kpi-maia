import Link from "next/link";
import { getPartOrder, listPartOrderFieldHistory } from "@/lib/partOrders";
import { updatePartArrivedAt, updateSentToClientAt } from "@/app/assistencia/pecas-actions";
import { PART_ORDER_STATUS_LABELS, PART_ORDER_STATUS_COLORS } from "@/lib/assistenciaLabels";
import { PartOrderActions } from "@/components/assistencia/PartOrderActions";
import { ExpectedAtField } from "@/components/assistencia/ExpectedAtField";
import { PartOrderDateField } from "@/components/assistencia/PartOrderDateField";
import { PartOrderEmailButton } from "@/components/assistencia/PartOrderEmailButton";
import { formatDateTimeBr } from "@/lib/formatDateTime";

// Conteúdo do detalhe do pedido de peça, extraído de pecas/[id]/page.tsx
// pra ser reaproveitado por DUAS rotas -- pedido do Victor 14/09/2026: "a
// aba peça... tambem apareça para a equipe técnica", mas "fica ruim se for
// compartilhada com a equipe tecnica a mesma tela da asisstencia" (achado
// dele depois de ver a versão anterior, que só trocava o cabeçalho).
// `basePath` decide pra onde apontam os links internos (Editar/Imprimir/
// voltar) -- /assistencia/pecas (assistência/admin) ou
// /assistencia/tecnico/pecas (equipe técnica, cabeçalho e navegação
// próprios, ver TecnicoPecasFrame.tsx). Os DADOS e AÇÕES são exatamente os
// mesmos pras duas rotas (pecas-actions.ts já cobre os dois mundos) -- só a
// apresentação muda.

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

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{value}</span>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-6 shadow-sm flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      <div className="grid sm:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

export async function PartOrderDetailContent({ id, basePath }: { id: string; basePath: string }) {
  const order = await getPartOrder(id);

  if (!order) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Pedido de peça não encontrado.</p>;
  }

  const fieldHistory = await listPartOrderFieldHistory(id);
  const partArrivedHistory = fieldHistory.filter((h) => h.field === "part_arrived_at");
  const sentToClientHistory = fieldHistory.filter((h) => h.field === "sent_to_client_at");

  return (
    <div className="flex flex-col gap-4">
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
          <div className="flex items-center gap-2 shrink-0">
            <PartOrderEmailButton o={order} />
            <Link
              href={`${basePath}/${order.id}/despacho`}
              className="text-sm font-semibold px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-500 transition-colors duration-150"
            >
              Imprimir
            </Link>
            <Link
              href={`${basePath}/${order.id}/editar`}
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
          {/* Pedido do Victor 15/09/2026 -- vai no e-mail pro representante
              do fornecedor (ver PartOrderEmailButton.tsx). */}
          <Field label="Nota fiscal" value={order.invoiceNumber} />
          <ExpectedAtField orderId={order.id} expectedAt={order.expectedAt} />
        </Block>

        <Block title="Andamento">
          <PartOrderDateField
            orderId={order.id}
            label="Peça chegou em"
            value={order.partArrivedAt}
            history={partArrivedHistory}
            action={updatePartArrivedAt}
          />
          <PartOrderDateField
            orderId={order.id}
            label="Enviada ao cliente em"
            value={order.sentToClientAt}
            history={sentToClientHistory}
            action={updateSentToClientAt}
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
      </div>

      <PartOrderActions
        orderId={order.id}
        status={order.status}
        notes={order.notes}
        delivered={!!order.sentToClientAt}
        resolvedWithoutPartAt={order.resolvedWithoutPartAt}
        resolvedWithoutPartBy={order.resolvedWithoutPartBy}
      />
    </div>
  );
}
