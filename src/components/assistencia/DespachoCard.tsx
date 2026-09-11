import Image from "next/image";
import { formatFullAddress, type ServiceRequestDetail } from "@/lib/serviceRequests";
import { formatDateOnlyBr } from "@/lib/formatDateTime";
import { REQUEST_TYPE_LABELS } from "@/lib/assistenciaLabels";
import type { RequestPhoto } from "@/lib/servicePhotos";

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

// Nota fiscal anexada na criação (pedido do Victor 09/09/2026: "que na hora
// de imprimir, cada notificação saia junto com sua respectiva nota") --
// sempre em folha própria (break-before), depois do cartão principal, pra
// não disputar espaço com o resto do despacho nem risco de cortar a
// imagem/PDF no meio. PDF usa <embed> (o navegador que imprime já sabe
// renderizar PDF inline) -- sem lib nenhuma nova, mesmo espírito de "só o
// que já existe" do resto do projeto.
//
// `#toolbar=0&navpanes=0&scrollbar=0` no fim da URL -- achado do Victor
// 10/09/2026 (print anexo): sem isso, o visualizador de PDF nativo do
// Chrome aparecia com a MOLDURA inteira (barra de zoom/página, painel de
// miniatura lateral, fundo cinza-escuro de "página vazia") junto do
// despacho, tanto na tela quanto impresso -- desperdiçando papel/espaço
// com interface de visualizador em vez de só o conteúdo da nota. Esses
// parâmetros são suportados pelo plugin de PDF do Chromium (não uma API
// do Next/React) e escondem essa moldura, deixando só a página da nota.
function InvoicePage({ photo }: { photo: RequestPhoto }) {
  const pdfUrl = `${photo.url}#toolbar=0&navpanes=0&scrollbar=0`;
  return (
    <div
      className="rounded-lg border overflow-hidden flex flex-col text-sm mt-4"
      style={{ background: "var(--surface-1)", borderColor: "var(--border)", breakBefore: "page", pageBreakBefore: "always" }}
    >
      <SectionTitle>Nota fiscal</SectionTitle>
      <div className="px-4 py-3 flex justify-center">
        {photo.isPdf ? (
          <embed src={pdfUrl} type="application/pdf" style={{ width: "100%", height: "260mm" }} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.url} alt="Nota fiscal" style={{ maxWidth: "100%", maxHeight: "260mm", objectFit: "contain" }} />
        )}
      </div>
    </div>
  );
}

// Papel físico da notificação -- extraído de [id]/despacho/page.tsx (pedido
// do Victor 19/08/2026: reaproveitar o mesmo cartão pra imprimir várias de
// uma vez, ver despacho-lote/page.tsx) pra não duplicar esse bloco grande
// de JSX em dois lugares. Mesmo conteúdo/ordem de sempre: dados do
// cliente, produto, descrição da solicitação, relatório logístico,
// assinatura -- sem "quem errou" (causa raiz), que é controle interno,
// não vai pro papel que cliente/motorista veem.
export function DespachoCard({ request, invoicePhoto }: { request: ServiceRequestDetail; invoicePhoto?: RequestPhoto | null }) {
  const isUrgente = request.urgent;
  const enderecoCompleto = [formatFullAddress(request), request.clientNeighborhood].filter(Boolean).join(" — ");

  return (
    <>
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
          {/* Tipo do chamado (envio de peça, troca de produto, troca com
              recolhimento...) -- pedido do Victor 09/09/2026: "na
              impressão... nao vai em nenhum lugar se é envio de peça...
              preciso que fique dentro do primeiro retangulo, bem visivel
              e logo abaixo da data e em italico". Correção no mesmo dia:
              tinha usado DRIVER_TYPE_LABELS primeiro (achando mais claro
              pro motorista), mas ficava diferente do que a própria tela
              da notificação mostra ("Envio de peça" vira "Recolhimento
              ou entrega de peça" na impressão) -- REQUEST_TYPE_LABELS
              direto, mesmo texto em todo canto do sistema. Retângulo com
              pontas arredondadas em volta -- pedido do Victor 09/09/2026,
              mesmo dia: "só coloque isso dentro de um retangulo com
              pontas arredondadas". Só borda (sem fundo) de propósito --
              já tem o URGENTE! preenchido logo acima brigando por
              atenção; um segundo bloco preenchido do mesmo tamanho
              competiria com ele em vez de complementar. */}
          <span
            className="text-base font-bold italic whitespace-nowrap px-2 py-0.5 rounded-lg border-2"
            style={{ color: "#000", borderColor: "#000" }}
          >
            {REQUEST_TYPE_LABELS[request.type] ?? request.type}
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
      <div className="px-4 py-2 flex flex-col gap-2">
        <Field label="Motorista / montador" value={request.driverName || request.assemblerName} />
        {/* Linhas em branco pra anotação manual -- reduzidas de 4 pra 2
            (achado do Victor 11/09/2026, print anexo: o despacho tava
            saindo em 3 folhas -- página inteira quase vazia entre o fim
            do conteúdo e a nota fiscal, que só forçava a 3ª folha porque
            sobrava espaço demais aqui embaixo). 2 linhas ainda dá espaço
            pra anotação rápida sem desperdiçar página inteira. */}
        <div className="flex flex-col gap-2 pt-1">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="border-b" style={{ borderColor: "var(--border)", height: "1rem" }} />
          ))}
        </div>
      </div>

      <div className="flex justify-center pb-2 pt-1">
        <div className="border-t w-56 text-center text-xs pt-1" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
          Assinatura do cliente
        </div>
      </div>
    </div>
    {invoicePhoto ? <InvoicePage photo={invoicePhoto} /> : null}
    </>
  );
}
