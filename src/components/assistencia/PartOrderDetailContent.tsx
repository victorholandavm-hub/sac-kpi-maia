import Link from "next/link";
import { getPartOrder, listPartOrderFieldHistory, listPartOrdersByGroupId, listPartOrderItems } from "@/lib/partOrders";
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

  // Peças-irmãs LEGADO (migration 0131, group_id) -- só os poucos
  // chamados criados antes da correção de 16/09/2026 (ver migration 0132)
  // ainda usam isso. Chamado novo nunca tem group_id.
  const groupSiblings = order.groupId ? await listPartOrdersByGroupId(order.groupId) : [];
  const otherGroupSiblings = groupSiblings.filter((s) => s.id !== order.id);

  // Demais peças deste chamado -- pedido do Victor 16/09/2026: "adicione
  // a opção de eu adicionar mais de uma peça na mesma solicitação, pois...
  // a fábrica manda tudo junto", corrigido no mesmo dia pra UM chamado só
  // (migration 0132) depois dele achar que 3 peças tinham virado 3
  // chamados linkados. Só busca quando o chamado realmente tem mais de 1
  // peça (extraItemsCount, ver PART_ORDER_COLUMNS/toPartOrder em
  // partOrders.ts) -- a esmagadora maioria não paga esse SELECT a mais.
  const extraItems = order.extraItemsCount > 0 ? await listPartOrderItems(order.id) : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl px-6 py-5 shadow-sm flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex flex-col gap-1.5 min-w-0">
            <span className="text-xs font-mono font-medium text-gray-500 dark:text-gray-400">
              {order.externalReference ?? `Chamado #${order.ticketNumber}`}
            </span>
            {/* Todas as peças no título quando o chamado tem mais de uma --
                pedido do Victor 16/09/2026: "preciso que todas as peças
                apareçam aqui, no caso de mais de uma peça no chamado". Antes
                só mostrava order.partName (a 1ª peça), as demais (extraItems)
                ficavam escondidas até descer pro bloco "Peça / Produto". */}
            {extraItems.length > 0 ? (
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex flex-col gap-0.5">
                <span>1. {order.partName}</span>
                {extraItems.map((item, i) => (
                  <span key={item.id}>
                    {i + 2}. {item.partName}
                  </span>
                ))}
              </h2>
            ) : (
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 truncate">{order.partName}</h2>
            )}
            <div>
              <StatusBadge status={order.status} />
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <PartOrderEmailButton o={order} groupId={order.groupId} extraItemsCount={order.extraItemsCount} />
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
        {/* Peças-irmãs da mesma solicitação -- pedido do Victor
            16/09/2026: "quando solicitamos mais de uma peça junta, a
            fábrica manda tudo junto". Cada peça continua sua própria
            linha/status (ver comentário em migration 0131) -- isso aqui é
            só pra não perder de vista que elas vieram juntas. */}
        {otherGroupSiblings.length > 0 ? (
          <div className="flex flex-col gap-1.5 pt-3 border-t border-gray-100 dark:border-gray-700">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Outras peças desta mesma solicitação ({otherGroupSiblings.length})
            </span>
            <div className="flex flex-wrap gap-2">
              {otherGroupSiblings.map((s) => (
                <Link
                  key={s.id}
                  href={`${basePath}/${s.id}`}
                  className="text-xs font-medium px-2.5 py-1 rounded-full border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150"
                >
                  {s.externalReference ?? `#${s.ticketNumber}`} · {s.partName}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Sem hierarquia entre a 1ª peça e as demais -- pedido do Victor
            16/09/2026: "aqui não tenha hierarquia de peça, apareça mais
            organizado... produto 1: xyz e depois peça 1: xyz... todos tem
            que ter produto e peça". Antes a 1ª peça vinha solta, com campos
            fora de ordem e sem rótulo "Peça" (só aparecia no título lá em
            cima) enquanto as demais ganhavam uma caixa à parte, mais
            "escondida" -- agora as duas passam pelo mesmo bloco, no mesmo
            formato, só numerado. */}
        <Block title={extraItems.length > 0 ? `Peças / Produtos (${extraItems.length + 1})` : "Peça / Produto"}>
          <Field label="Fornecedor" value={order.supplier} />
          {[{ id: "main", product: order.product, partName: order.partName, partCode: order.partCode, color: order.color }, ...extraItems].map(
            (piece: { id: string; product: string | null; partName: string; partCode: string | null; color: string | null }, i: number) => (
              <div
                key={piece.id}
                className={`sm:col-span-2 grid sm:grid-cols-2 gap-4 ${i > 0 ? "pt-4 border-t border-gray-100 dark:border-gray-700" : ""}`}
              >
                <Field label={`Produto ${i + 1}`} value={piece.product} />
                <Field label={`Peça ${i + 1}`} value={piece.partName} />
                <Field label="Código da peça" value={piece.partCode} />
                <Field label="Cor" value={piece.color} />
              </div>
            )
          )}
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
