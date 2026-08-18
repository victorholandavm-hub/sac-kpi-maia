import Link from "next/link";
import Image from "next/image";
import { getProfile } from "@/lib/dal";
import { getRequestDetail, formatFullAddress } from "@/lib/serviceRequests";
import { CAUSA_RAIZ_LABELS } from "@/lib/assistenciaLabels";
import { PrintButton } from "@/components/assistencia/PrintButton";

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

// Papel físico de hoje (pedido do Victor 17/08/2026): logo + título no
// topo, tudo numa folha só, na ordem — dados do cliente, descrição do
// produto, descrição da solicitação (quem autorizou/problema/quem errou/
// observação), relatório logístico (texto livre) e por fim a assinatura.
// Um template só pra todo tipo (antes tinha um branch à parte só pra
// troca_produto) -- tamanho de fonte/espaçamento pequenos de propósito,
// pensados pra caber numa folha A4 sem estourar pra segunda página.
export default async function DespachoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getProfile();
  const result = await getRequestDetail(id);

  if (!result) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Solicitação não encontrada.
      </p>
    );
  }

  const { request } = result;

  // Antes travava SAC em SAC_MANAGED_TYPES (só troca/entrega de produto e
  // notificação externa) -- mas createSacRequest (actions.ts) deixa o SAC
  // criar montagem e envio de peça também, e a tela de detalhe normal
  // (ver [id]/page.tsx) já deixa qualquer papel VER qualquer chamado
  // (só a EDIÇÃO é restrita por tipo). Sem esse alinhamento, o SAC caía em
  // "Acesso restrito" ao tentar imprimir o despacho de um chamado que ele
  // mesmo acabou de criar (redirect direto pra cá desde 17/08/2026).
  const canView = profile.role === "assistencia" || profile.role === "admin" || profile.role === "sac";
  if (!canView) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Acesso restrito.
      </p>
    );
  }

  const isUrgente = request.shift === "urgencia";
  const enderecoCompleto = [formatFullAddress(request), request.clientNeighborhood].filter(Boolean).join(" — ");

  const causaRaizLine =
    request.causaRaiz === "erro_conferencia"
      ? [request.causaCarga ? `Carga: ${request.causaCarga}` : null, request.causaConferente ? `Conferente: ${request.causaConferente}` : null]
          .filter(Boolean)
          .join(" · ")
      : request.causaRaiz === "erro_motorista"
        ? [request.causaCarga ? `Carga: ${request.causaCarga}` : null, request.driverName ? `Motorista: ${request.driverName}` : null]
            .filter(Boolean)
            .join(" · ")
        : null;

  return (
    <div className="flex flex-col gap-4 max-w-2xl despacho-print">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link href={`/assistencia/${request.id}`} className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
          ← Ver chamado completo
        </Link>
        <PrintButton />
      </div>

      {/* @page/margin aqui mesmo (não no CSS global) -- só essa página
          precisa desse ajuste, o resto do sistema nunca é impresso. Sem
          print-color-adjust, o navegador some com o fundo preto das
          SectionTitle na impressão (economia de tinta por padrão) e a folha
          sai toda branca -- pedido do Victor 18/08/2026: as listras pretas
          têm que sair pretas de verdade, igual a notificação física. */}
      <style>{`
        @page { size: A4; margin: 10mm; }
        @media print {
          html, body { height: auto !important; }
          * { print-color-adjust: exact !important; -webkit-print-color-adjust: exact !important; }
        }
      `}</style>

      <div
        className="rounded-lg border overflow-hidden flex flex-col text-sm"
        style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
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
          {isUrgente ? (
            <span className="text-sm font-bold px-2 py-1 rounded" style={{ color: "#fff", background: "var(--status-critical)" }}>
              URGENTE!
            </span>
          ) : null}
        </div>

        <SectionTitle>Dados do cliente</SectionTitle>
        <div className="grid sm:grid-cols-2 gap-3 px-4 py-3">
          <Field label="Nome" value={request.clientName} />
          <Field label="Telefone" value={request.clientPhone} />
          <Field label="Endereço" value={enderecoCompleto} />
        </div>

        <SectionTitle>Descrição do produto</SectionTitle>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
              <th className="px-3 py-1 text-left font-semibold w-24">Código</th>
              <th className="px-3 py-1 text-left font-semibold">Produto</th>
              <th className="px-3 py-1 text-right font-semibold w-14">Qtd</th>
            </tr>
          </thead>
          <tbody>
            {request.items.length > 0 ? (
              request.items.map((item) => (
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

        <SectionTitle>Descrição da solicitação</SectionTitle>
        <div className="flex flex-col gap-2 px-4 py-3">
          <Field label="Autorizado por" value={request.authorizedBy} />
          <Field label="Problema" value={request.reason} />
          <Field label="Quem errou" value={request.causaRaiz ? (CAUSA_RAIZ_LABELS[request.causaRaiz] ?? request.causaRaiz) : null} />
          {causaRaizLine ? <Field label="Detalhe" value={causaRaizLine} /> : null}
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
    </div>
  );
}
