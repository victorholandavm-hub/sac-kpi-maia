import { redirect } from "next/navigation";
import Link from "next/link";
import { ROLE_LABELS } from "@/lib/assistenciaLabels";
import { requirePecasViewer } from "@/lib/pecasAccess";
import { signOut } from "@/app/assistencia/actions";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";
import { AssistenciaNav } from "@/components/assistencia/AssistenciaNav";
import { MobileNav } from "@/components/assistencia/MobileNav";
import { ToastProvider } from "@/components/assistencia/ToastProvider";

// Layout PRÓPRIO pra /assistencia/pecas (fora do grupo de rotas
// `(app)/layout.tsx`, de propósito) -- pedido do Victor 14/09/2026:
// "preciso agora que a aba peça, de controle assistencia, tambem apareça
// para a equipe técnica". O `(app)/layout.tsx` compartilhado chama
// `getProfile()` incondicionalmente logo no topo, que REDIRECIONA pro
// login de assistência antes até de chegar na página, então uma sessão
// técnica (PIN, sem Profile/Supabase Auth por trás, ver tecnicoAuth.ts)
// nunca conseguiria passar por ele. Mover pecas/** pra fora do grupo (não
// muda a URL nenhuma -- grupo de rotas é só organização de pasta, invisível
// pro navegador) resolve isso sem arriscar as ~40 outras páginas que
// dependem do layout compartilhado continuar exatamente como está.
//
// Equipe técnica GANHOU rota própria (/assistencia/tecnico/pecas, visual
// denso igual fila/estoque) em vez de compartilhar esta -- achado do Victor
// 14/09/2026, depois de ver a 1ª versão (só o cabeçalho mudava por
// sessão): "fica ruim se for compartilhada com a equipe tecnica a mesma
// tela da asisstencia". Sessão técnica que cair aqui (link antigo salvo,
// por exemplo) é redirecionada pra lá em vez de ver esta tela.
export default async function PecasLayout({ children }: { children: React.ReactNode }) {
  const { profile, tecnicoName } = await requirePecasViewer();

  if (tecnicoName) {
    redirect("/assistencia/tecnico/pecas");
  }

  // Mesma estrutura de (app)/layout.tsx (header/nav/mobile nav
  // compartilhados), só sem a contagem de badge de Solicitações/Encomendas
  // (AssistenciaNav aceita `counts` opcional -- sem ela os badges dessas 2
  // abas só ficam 0 NESTA página específica, o resto do app continua
  // mostrando o número certo normalmente). Replicar em vez de reaproveitar
  // o layout compartilhado é o preço de não arriscar mexer nele -- ver
  // comentário acima.
  return (
    <ToastProvider>
      <div className="w-full max-w-[1600px] mx-auto px-6 pt-6 pb-24 sm:pb-6 print:p-0 flex flex-col gap-6 min-w-0">
        <div className="flex flex-col gap-3 print:hidden">
          <AssistenciaHeader
            title="Assistência — Lojas Maia"
            subtitle={`${profile!.fullName} · ${ROLE_LABELS[profile!.role] ?? profile!.role}${profile!.storeId ? ` · Loja ${profile!.storeId}` : ""}`}
          >
            <div className="flex items-center gap-3">
              {profile!.role === "admin" ? (
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
          <div className="hidden sm:block">
            <AssistenciaNav />
          </div>
        </div>
        {children}
      </div>
      <div className="print:hidden">
        <MobileNav />
      </div>
    </ToastProvider>
  );
}
