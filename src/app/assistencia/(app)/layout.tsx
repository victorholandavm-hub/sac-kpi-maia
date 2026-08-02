import Link from "next/link";
import { getProfile } from "@/lib/dal";
import { ROLE_LABELS } from "@/lib/assistenciaLabels";
import { signOut } from "@/app/assistencia/actions";
import { countRequestsOverview } from "@/lib/serviceRequests";
import { countPedidosEncomendaSolicitados } from "@/lib/pedidosEncomenda";
import { AssistenciaNav } from "@/components/assistencia/AssistenciaNav";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";
import { ToastProvider } from "@/components/assistencia/ToastProvider";
import { MobileNav } from "@/components/assistencia/MobileNav";
import { NotificationBell } from "@/components/assistencia/NotificationBell";
import { listAdminNotificationsAction } from "@/app/assistencia/notifications-actions";

export default async function AssistenciaAppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  const isAdmin = profile.role === "admin";
  const isSac = profile.role === "sac";

  // Contagem pra badge nas abas Solicitações/Encomendas -- só quando faz
  // sentido pro papel (SAC nem mostra essa navegação, ver abaixo).
  const [requestsOverview, pedidosSolicitados] = isSac
    ? [null, 0]
    : await Promise.all([countRequestsOverview(), countPedidosEncomendaSolicitados()]);
  const counts = {
    solicitacoes: requestsOverview?.openNoContact ?? 0,
    encomendas: pedidosSolicitados,
  };

  return (
    <ToastProvider>
      <div className="max-w-5xl mx-auto px-6 pt-6 pb-24 sm:pb-6 flex flex-col gap-6 w-full min-w-0">
        <div className="flex flex-col gap-3 print:hidden">
          <AssistenciaHeader
            title="Assistência — Lojas Maia"
            subtitle={`${profile.fullName} · ${ROLE_LABELS[profile.role] ?? profile.role}${profile.storeId ? ` · Loja ${profile.storeId}` : ""}`}
          >
            <div className="flex items-center gap-3">
              {isAdmin ? <NotificationBell fetchAction={listAdminNotificationsAction} storageKey="admin" /> : null}
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
              <AssistenciaNav isAdmin={isAdmin} counts={counts} />
            </div>
          )}
        </div>
        {children}
      </div>
      {isSac ? null : (
        <div className="print:hidden">
          <MobileNav isAdmin={isAdmin} counts={counts} />
        </div>
      )}
    </ToastProvider>
  );
}
