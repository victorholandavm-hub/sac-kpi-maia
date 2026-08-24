import Link from "next/link";
import { getProfile } from "@/lib/dal";
import { getRequestDetail } from "@/lib/serviceRequests";
import { PrintButton } from "@/components/assistencia/PrintButton";
import { DespachoCard } from "@/components/assistencia/DespachoCard";

// Papel físico de hoje (pedido do Victor 17/08/2026): logo + título no
// topo, tudo numa folha só -- ver DespachoCard.tsx pro conteúdo do cartão
// (compartilhado com despacho-lote/page.tsx, pra imprimir várias de uma
// vez, pedido do Victor 19/08/2026).
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

  return (
    <div className="flex flex-col gap-4 max-w-2xl print:max-w-none despacho-print">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link href={`/assistencia/${request.id}`} className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
          ← Ver chamado completo
        </Link>
        <PrintButton requestIds={[request.id]} />
      </div>

      {/* @page/margin aqui mesmo (não no CSS global) -- só essa página
          precisa desse ajuste, o resto do sistema nunca é impresso. Sem
          print-color-adjust, o navegador some com o fundo preto das
          SectionTitle na impressão (economia de tinta por padrão) e a folha
          sai toda branca -- pedido do Victor 18/08/2026: as listras pretas
          têm que sair pretas de verdade, igual a notificação física.
          max-w-2xl (tela) travava a largura na impressão também, deixando o
          papel com uma faixa em branco na lateral em vez de ocupar a folha
          A4 inteira -- achado do Victor 24/08/2026: "a impressão... ainda
          nao está na folha A4 inteira, precisa redimensionar certo".
          print:max-w-none acima solta a largura; largura/altura 100% aqui
          garante que o cartão realmente estica até a borda da margem, não
          só o container em volta dele. */}
      <style>{`
        @page { size: A4; margin: 10mm; }
        @media print {
          html, body { height: auto !important; }
          * { print-color-adjust: exact !important; -webkit-print-color-adjust: exact !important; }
          .despacho-print { width: 100% !important; max-width: 100% !important; }
        }
      `}</style>

      <DespachoCard request={request} />
    </div>
  );
}
