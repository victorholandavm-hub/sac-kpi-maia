import Link from "next/link";
import { getProfile } from "@/lib/dal";
import { getRequestDetail, type ServiceRequestDetail } from "@/lib/serviceRequests";
import { PrintButton, type PrintTarget } from "@/components/assistencia/PrintButton";
import { DespachoCard } from "@/components/assistencia/DespachoCard";

export const dynamic = "force-dynamic";

// Impressão em lote (pedido do Victor 19/08/2026: "selecione todas as
// notificações de um dia e coloque todas juntas pra impressão") -- mesmo
// cartão de despacho de sempre (ver DespachoCard.tsx), um atrás do outro
// com quebra de página entre cada um, tudo numa impressão só em vez de
// abrir/imprimir uma por uma. Chamada com `?ids=uuid1,uuid2,...` -- ver o
// botão "Imprimir selecionadas" em NotificacoesList.tsx.
export default async function DespachoLotePage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const profile = await getProfile();
  const canView = profile.role === "assistencia" || profile.role === "admin" || profile.role === "sac";
  if (!canView) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Acesso restrito.
      </p>
    );
  }

  const { ids: idsParam } = await searchParams;
  const ids = (idsParam ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (ids.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Nenhuma solicitação selecionada.
      </p>
    );
  }

  const results = await Promise.all(ids.map((id) => getRequestDetail(id)));
  const found = results.filter((r) => r !== null);
  const requests: ServiceRequestDetail[] = found.map((r) => r.request);

  // Impedir reimpressão -- pedido do Victor 28/08/2026 (ver PrintButton.tsx
  // pro resto do racional). Admin sempre pode reimprimir ("só eu poderia
  // imprimir mais de uma vez") -- sem checagem nenhuma pra ele.
  const isAdmin = profile.role === "admin";
  const alreadyPrintedById = new Map(found.map((r) => [r.request.id, r.events.some((e) => e.eventType === "printed")]));
  const targets: PrintTarget[] = requests.map((r) => ({
    id: r.id,
    ticketNumber: r.ticketNumber,
    clientName: r.clientName,
    alreadyPrinted: alreadyPrintedById.get(r.id) ?? false,
  }));
  // Só entra no papel de verdade (impressão em lote parcial) quem não é
  // admin E já foi impressa -- calculado no servidor, não depende de
  // nenhum clique/estado do PrintButton (ver comentário lá).
  function hideOnPrint(requestId: string): boolean {
    return !isAdmin && (alreadyPrintedById.get(requestId) ?? false);
  }
  // `break-after: page` precisa ficar em todo item VISÍVEL no papel,
  // exceto o último visível -- CSS `:not(:last-child)` não sabe de
  // `display:none`, aplicaria no penúltimo (visualmente último) e sobraria
  // uma folha em branco no fim. Calculado aqui, não em CSS.
  const visibleIds = requests.filter((r) => !hideOnPrint(r.id)).map((r) => r.id);
  const lastVisibleId = visibleIds[visibleIds.length - 1];

  return (
    <div className="flex flex-col gap-4 max-w-2xl print:max-w-none despacho-print">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link href="/assistencia/fila" className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
          ← Voltar
        </Link>
        <PrintButton targets={targets} isAdmin={isAdmin} />
      </div>

      {requests.length < ids.length ? (
        <p className="text-sm print:hidden" style={{ color: "var(--status-warning)" }}>
          {ids.length - requests.length} solicitação(ões) não encontrada(s) -- só as {requests.length} encontradas entram na
          impressão.
        </p>
      ) : null}

      {/* Mesmo ajuste de @page do despacho individual -- break-after força
          cada cartão pra sua própria folha na impressão (tela mostra tudo
          empilhado com espaço normal entre eles). max-w-2xl (tela) travava
          a largura na impressão também -- achado do Victor 24/08/2026: "a
          impressão... ainda nao está na folha A4 inteira, precisa
          redimensionar certo". print:max-w-none + width 100% garante que o
          cartão estica até a borda da margem A4. `.hide-on-print` esconde
          na impressão os cartões já impressos antes (não-admin, pedido do
          Victor 28/08/2026 -- ver PrintButton.tsx); break-after vai só nos
          itens visíveis via className (`.break-after-page`, calculado em
          JS acima), não em `:not(:last-child)` -- CSS não sabe quais
          cartões estão escondidos, aplicaria no penúltimo (visualmente
          último) e sobraria uma folha em branco no fim. */}
      <style>{`
        @page { size: A4; margin: 10mm; }
        @media print {
          html, body { height: auto !important; }
          * { print-color-adjust: exact !important; -webkit-print-color-adjust: exact !important; }
          .despacho-print { width: 100% !important; max-width: 100% !important; }
          .hide-on-print { display: none !important; }
        }
        .break-after-page { break-after: page; page-break-after: always; }
      `}</style>

      <div className="flex flex-col gap-6">
        {requests.map((request) => {
          const hidden = hideOnPrint(request.id);
          const className = ["despacho-lote-item", hidden ? "hide-on-print" : "", !hidden && request.id !== lastVisibleId ? "break-after-page" : ""]
            .filter(Boolean)
            .join(" ");
          return (
            <div key={request.id} className={className}>
              <DespachoCard request={request} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
