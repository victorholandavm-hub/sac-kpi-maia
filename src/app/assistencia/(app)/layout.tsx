import Link from "next/link";
import { getProfile, canSeeOwnAssemblerStoreRequests } from "@/lib/dal";
import { ROLE_LABELS, OWN_ASSEMBLER_STORE_IDS } from "@/lib/assistenciaLabels";
import { signOut } from "@/app/assistencia/actions";
import { countVisitasOpenNoContact } from "@/lib/serviceRequests";
import { countPedidosEncomendaSolicitados } from "@/lib/pedidosEncomenda";
import { AssistenciaNav } from "@/components/assistencia/AssistenciaNav";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";
import { ToastProvider } from "@/components/assistencia/ToastProvider";
import { MobileNav } from "@/components/assistencia/MobileNav";
import { NotificationBell } from "@/components/assistencia/NotificationBell";
import { listAssistenciaTeamNotificationsAction } from "@/app/assistencia/notifications-actions";

export default async function AssistenciaAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getProfile();
  const isAdmin = profile.role === "admin";
  const isSac = profile.role === "sac";
  // Sino de "precisa remarcar" (e outros alertas de admin, ex.: falha de
  // sync) -- antes só admin via, mas o alerta de remarcação também precisa
  // chegar pro resto da equipe assistência (role "assistencia"), não só
  // admin (ver notifySac/notifyAssistencia em notifications.ts).
  const showTeamBell = isAdmin || profile.role === "assistencia";

  // Contagem pra badge nas abas Solicitações/Encomendas -- só quando faz
  // sentido pro papel (SAC nem mostra essa navegação, ver abaixo). Exclui
  // montagem/desmontagem/vistoria de loja com montador próprio de quem não
  // tem visibilidade sobre elas (ver OWN_ASSEMBLER_STORE_IDS) -- sem isso o
  // número do badge denunciava chamado pendente que a lista já esconde.
  //
  // "Solicitações" só conta montagem/desmontagem/vistoria/troca de peça
  // (o que a aba de fato lista, ver VISITA_REQUEST_TYPES) -- pedido do
  // Victor 21/08/2026: antes contava TODO chamado "aberta", inclusive
  // entrega/notificação de assistência, que não tem nada a ver com essa
  // aba (mora em /assistencia/sac/notificacoes ou na aba Entregas).
  const excludeOwnAssemblerStoreIds = canSeeOwnAssemblerStoreRequests(profile) ? undefined : [...OWN_ASSEMBLER_STORE_IDS];
  const [solicitacoesAbertas, pedidosSolicitados] = isSac
    ? [0, 0]
    : await Promise.all([countVisitasOpenNoContact(excludeOwnAssemblerStoreIds), countPedidosEncomendaSolicitados()]);
  const counts = {
    solicitacoes: solicitacoesAbertas,
    encomendas: pedidosSolicitados,
  };

  return (
    <ToastProvider>
      {/* print:p-0 -- o resto do padding some junto com o cabeçalho/nav
          (print:hidden), mas o espaço reservado (pt-6/pb-24, pensado pra
          rolagem na tela) continuava sendo impresso vazio -- empurrava o
          despacho pra baixo o bastante pra vazar pra segunda folha. */}
      <div className="max-w-5xl mx-auto px-6 pt-6 pb-24 sm:pb-6 print:p-0 flex flex-col gap-6 w-full min-w-0">
        <div className="flex flex-col gap-3 print:hidden">
          <AssistenciaHeader
            title="Assistência — Lojas Maia"
            subtitle={`${profile.fullName} · ${ROLE_LABELS[profile.role] ?? profile.role}${profile.storeId ? ` · Loja ${profile.storeId}` : ""}`}
          >
            <div className="flex items-center gap-3">
              {showTeamBell ? <NotificationBell fetchAction={listAssistenciaTeamNotificationsAction} storageKey="assistencia-team" /> : null}
              {/* Fora da fila de abas que rola horizontal (AssistenciaNav) de
                  propósito -- "Admin" ficava quase invisível no fim de uma
                  fileira de 11 abas sem indicação nenhuma de que dava pra
                  rolar pra ver mais. Fixo aqui, sempre visível. */}
              {isAdmin ? (
                <Link href="/assistencia/admin" className="text-sm font-semibold" style={{ color: "var(--brand-orange)" }}>
                  Admin
                </Link>
              ) : null}
              <form action={signOut}>
                <button type="submit" className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
                  Sair
                </button>
              </form>
            </div>
          </AssistenciaHeader>
          {isSac ? (
            <Link href="/assistencia/sac" className="text-sm underline self-start" style={{ color: "var(--text-secondary)" }}>
              ← Voltar pro SAC
            </Link>
          ) : (
            <div className="hidden sm:block">
              <AssistenciaNav counts={counts} />
            </div>
          )}
        </div>
        {children}
      </div>
      {isSac ? null : (
        <div className="print:hidden">
          <MobileNav counts={counts} />
        </div>
      )}
    </ToastProvider>
  );
}
