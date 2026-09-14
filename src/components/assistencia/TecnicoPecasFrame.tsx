import Image from "next/image";
import { tecnicoSignOut } from "@/app/assistencia/tecnico-actions";
import { TecnicoTabs } from "@/components/assistencia/TecnicoTabs";
import { ToastProvider } from "@/components/assistencia/ToastProvider";
import { ThemeToggle } from "@/components/ThemeToggle";

// Cabeçalho verde + abas, comum às 5 páginas de /assistencia/tecnico/pecas
// (lista, nova, detalhe, editar -- despacho fica de fora, é impressão) --
// pedido do Victor 14/09/2026, rota própria da equipe técnica pra Peças
// (ver TecnicoTabs.tsx). Mesmo padrão de tecnico/page.tsx e
// tecnico/estoque/page.tsx (cada uma com seu próprio cabeçalho, sem layout
// compartilhado entre elas) -- extraído aqui só porque agora são 4 páginas
// repetindo o mesmo bloco, não 1.
export function TecnicoPecasFrame({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
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
                <h1 className="font-bold text-lg text-white truncate">{title}</h1>
                <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.78)" }}>
                  {subtitle}
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

        <div className="flex flex-col gap-3 px-6 pt-4 pb-6">
          <TecnicoTabs active="pecas" />
          {children}
        </div>
      </div>
    </ToastProvider>
  );
}
