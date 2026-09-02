import Image from "next/image";
import { formatFullAddress, type ServiceRequestDetail } from "@/lib/serviceRequests";
import { formatDateOnlyBr } from "@/lib/formatDateTime";

// scheduledDate é "YYYY-MM-DD" puro (sem hora/fuso) -- new Date(iso) via
// formatDateOnlyBr trataria como UTC meia-noite e, convertendo pro fuso de
// Fortaleza, podia voltar um dia. Mesmo padrão de split/reverse/join já
// usado em toda a base pra exibir scheduledDate (ver actions.ts,
// DeliveryRequestDetailContent.tsx) -- só formatDateOnlyBr (timestamp de
// verdade, com hora) precisa de conversão de fuso.
function formatScheduledDateBr(dateStr: string): string {
  return dateStr.split("-").reverse().join("/");
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      <span className="text-sm" style={{ color: "var(--text-primary)" }}>
        {value || "—"}
      </span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="px-3 py-1 text-xs font-semibold uppercase tracking-wide"
      style={{ background: "var(--text-primary)", color: "var(--surface-1)" }}
    >
      {children}
    </div>
  );
}

// Extraída pra reaproveitar duas vezes em troca_produto (entregar/recolher,
// ver DespachoCard abaixo) sem duplicar a tabela inteira -- outros tipos
// continuam com uma tabela só, chamado direto com todos os itens.
function ProductTable({ items }: { items: ServiceRequestDetail["items"] }) {
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="border-b" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          <th className="px-3 py-1 text-left font-semibold w-24">Código</th>
          <th className="px-3 py-1 text-left font-semibold">Produto</th>
          <th className="px-3 py-1 text-right font-semibold w-14">Qtd</th>
        </tr>
      </thead>
      <tbody>
        {items.length > 0 ? (
          items.map((item) => (
            <tr key={item.id} className="border-b" style={{ borderColor: "var(--border)" }}>
              <td className="px-3 py-1" style={{ color: "var(--text-secondary)" }}>
                {item.partCode || "—"}
              </td>
              <td className="px-3 py-1" style={{ color: "var(--text-primary)" }}>
                {item.product}
              </td>
              <td className="px-3 py-1 text-right" style={{ color: "var(--text-primary)" }}>
                {item.quantity}
              </td>
            </tr>
          ))
        ) : (
          <tr>
            <td className="px-3 py-1" style={{ color: "var(--text-muted)" }} colSpan={3}>
              —
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

// Papel físico da notificação -- extraído de [id]/despacho/page.tsx (pedido
// do Victor 19/08/2026: reaproveitar o mesmo cartão pra imprimir várias de
// uma vez, ver despacho-lote/page.tsx) pra não duplicar esse bloco grande
// de JSX em dois lugares. Mesmo conteúdo/ordem de sempre: dados do
// cliente, produto, descrição da solicitação, relatório logístico,
// assinatura -- sem "quem errou" (causa raiz), que é controle interno,
// não vai pro papel que cliente/motorista veem.
export function DespachoCard({ request }: { request: ServiceRequestDetail }) {
  const isUrgente = request.urgent;
  const enderecoCompleto = [formatFullAddress(request), request.clientNeighborhood].filter(Boolean).join(" — ");

  return (
    <div className="rounded-lg border overflow-hidden flex flex-col text-sm" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
      <div className="flex items-start justify-between gap-3 px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="Lojas Maia" width={112} height={112} className="h-12 w-12 object-contain shrink-0" />
          <div className="flex flex-col">
            <h1 className="text-base font-bold leading-tight" style={{ color: "var(--brand-green)" }}>
              Notificação de Assistência
            </h1>
            <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
              Chamado #{request.ticketNumber} · {request.storeName}
            </span>
          </div>
        </div>
        {/* Data no canto, grande e em preto -- pedido do Victor 27/08/2026:
            "a data na notificação de assistencia, precisa ficar no canto,
            maior e na cor preta em negrito" (papel impresso, sem relação
            com tema claro/escuro da tela -- preto de verdade, não
            var(--text-primary), é a mesma convenção de qualquer
            documento impresso). Continua sendo a data da ROTA
            (scheduledDate), não a de abertura -- ver achado do Victor
            26/08/2026 mais abaixo, comentário movido pra cá junto da
            data em si. Antes mostrava createdAt (pedido do Victor
            23/08/2026), o que congelava a impressão na data de criação
            mesmo depois do chamado ser remarcado pra outro dia. Sem
            scheduledDate ainda (chamado sem rota definida), cai pra
            createdAt -- melhor que não mostrar nada. */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          {isUrgente ? (
            <span className="text-sm font-bold px-2 py-1 rounded" style={{ color: "#fff", background: "var(--status-critical)" }}>
              URGENTE!
            </span>
          ) : null}
          <span className="text-2xl font-black leading-none whitespace-nowrap" style={{ color: "#000" }}>
            {request.scheduledDate ? formatScheduledDateBr(request.scheduledDate) : formatDateOnlyBr(request.createdAt)}
          </span>
        </div>
      </div>

      <SectionTitle>Dados do cliente</SectionTitle>
      <div className="grid sm:grid-cols-2 gap-3 px-4 py-3">
        <Field label="Nome" value={request.clientName} />
        <Field label="Telefone" value={request.clientPhone} />
        <Field label="Endereço" value={enderecoCompleto} />
        {request.clientTimeRestriction ? <Field label="⏰ Restrição de horário" value={request.clientTimeRestriction} /> : null}
      </div>

      {/* Troca com recolhimento (troca_produto) e envio de peça com
          recolhimento de peça (envio_recolhimento_peca, pedido do Victor
          02/09/2026) viram duas tabelas -- o motorista precisa saber
          separado o que entrega do que recolhe, não uma lista só misturada.
          Outros tipos continuam com uma tabela só, igual sempre foi. */}
      {request.type === "troca_produto" || request.type === "envio_recolhimento_peca" ? (
        <>
          <SectionTitle>Produtos a entregar</SectionTitle>
          <ProductTable items={request.items.filter((item) => !item.isPickup)} />
          <SectionTitle>Produtos a recolher</SectionTitle>
          <ProductTable items={request.items.filter((item) => item.isPickup)} />
        </>
      ) : (
        <>
          <SectionTitle>Descrição do produto</SectionTitle>
          <ProductTable items={request.items} />
        </>
      )}

      <SectionTitle>Descrição da solicitação</SectionTitle>
      <div className="flex flex-col gap-2 px-4 py-3">
        {/* Atendente que abriu a notificação -- pedido do Victor
            21/08/2026: "preciso que na impressão... apareça quem foi o
            atendente que fez aquela notificação". Não é o mesmo que
            "Autorizado por" (quem autorizou a troca/entrega, texto livre
            -- ver comentário em serviceRequests.ts/actions.ts sobre por
            que os dois são campos separados desde 18/08/2026). */}
        <Field label="Atendente" value={request.requestedByName} />
        <Field label="Autorizado por" value={request.authorizedBy} />
        <Field label="Problema" value={request.reason} />
        <Field label="Observação" value={request.restrictionNote || request.notes} />
      </div>

      <SectionTitle>Relatório logístico</SectionTitle>
      <div className="px-4 py-3 flex flex-col gap-4">
        <Field label="Motorista / montador" value={request.driverName || request.assemblerName} />
        <div className="flex flex-col gap-3 pt-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="border-b" style={{ borderColor: "var(--border)", height: "1rem" }} />
          ))}
        </div>
      </div>

      <div className="flex justify-center pb-4 pt-2">
        <div className="border-t w-56 text-center text-xs pt-1" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
          Assinatura do cliente
        </div>
      </div>
    </div>
  );
}
