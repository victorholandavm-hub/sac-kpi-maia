import Image from "next/image";
import Link from "next/link";
import { ROLE_LABELS } from "@/lib/assistenciaLabels";
import { requirePecasViewer } from "@/lib/pecasAccess";
import { signOut } from "@/app/assistencia/actions";
import { tecnicoSignOut } from "@/app/assistencia/tecnico-actions";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";
import { AssistenciaNav } from "@/components/assistencia/AssistenciaNav";
import { MobileNav } from "@/components/assistencia/MobileNav";
import { TecnicoTabs } from "@/components/assistencia/TecnicoTabs";
import { ToastProvider } from "@/components/assistencia/ToastProvider";
import { ThemeToggle } from "@/components/ThemeToggle";

// Layout PRÓPRIO pra /assistencia/pecas (fora do grupo de rotas
// `(app)/layout.tsx`, de propósito) -- pedido do Victor 14/09/2026:
// "preciso agora que a aba peça, de controle assistencia, tambem apareça
// para a equipe técnica". A equipe técnica loga por PIN (sessão própria,
// ver tecnicoAuth.ts), sem Profile/Supabase Auth nenhum por trás -- o
// `(app)/layout.tsx` compartilhado chama `getProfile()` incondicionalmente
// logo no topo, que REDIRECIONA pro login de assistência antes até de
// chegar na página, então uma sessão técnica nunca conseguiria passar por
// ele. Mover pecas/** pra fora do grupo (não muda a URL nenhuma -- grupo
// de rotas é só organização de pasta, invisível pro navegador) resolve
// isso sem arriscar as ~40 outras páginas que dependem do layout
// compartilhado continuar exatamente como está.
// `requirePecasViewer` (pecasAccess.ts) decide aqui, uma vez só, qual dos
// dois mundos é essa sessão -- Profile assistência/admin renderiza o
// cabeçalho/nav de sempre (idêntico ao resto do sistema); sessão técnica
// renderiza o cabeçalho verde + as 3 abas próprias dela (ver
// TecnicoTabs.tsx), mesmo visual das outras 2 telas que ela já usa.
export default async function PecasLayout({ children }: { children: React.ReactNode }) {
  const { profile, tecnicoName } = await requirePecasViewer();

  if (tecnicoName) {
    return (
      <ToastProvider>
        <div className="w-full flex flex-col min-w-0 bg-[var(--background)] min-h-screen">
          <div className="w-full" style={{ background: "var(--brand-green)" }}>
            <div className="flex items-center justify-between gap-4 px-6 py-3 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <Image
                  src="/logo.png"
                  alt="Lojas Maia"
                  width={72}
                  height={72}
                  className="h-9 w-9 object-contain rounded-full shrink-0"
                  style={{ background: "rgba(255,255,255,0.9)" }}
                />
                <div className="leading-tight min-w-0">
                  <h1 className="font-bold text-lg text-white truncate">Peças</h1>
                  <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.78)" }}>
                    Olá, {tecnicoName} — pedidos de peça de fornecedor: acompanhe status, chegada e envio ao cliente.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-sm shrink-0">
                <ThemeToggle />
                <form action={tecnicoSignOut}>
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-lg font-medium text-white/80 hover:text-white hover:bg-white dark:hover:bg-gray-700/10 transition-colors duration-150"
                  >
                    Sair
                  </button>
                </form>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 px-6 pt-4 pb-6">
            <TecnicoTabs active="pecas" />
            {children}
          </div>
        </div>
      </ToastProvider>
    );
  }

  // Ramo Profile (assistência/admin) -- mesma estrutura de
  // (app)/layout.tsx (header/nav/mobile nav compartilhados), só sem a
  // contagem de badge de Solicitações/Encomendas (AssistenciaNav aceita
  // `counts` opcional -- sem ela os badges dessas 2 abas só ficam 0 NESTA
  // página específica, o resto do app continua mostrando o número certo
  // normalmente). Replicar em vez de reaproveitar o layout compartilhado
  // é o preço de não arriscar mexer nele -- ver comentário acima.
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
