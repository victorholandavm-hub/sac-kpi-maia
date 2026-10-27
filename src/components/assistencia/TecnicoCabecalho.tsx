import Image from "next/image";
import { tecnicoSignOut } from "@/app/assistencia/tecnico-actions";
import { ThemeToggle } from "@/components/ThemeToggle";

// Cabeçalho verde das telas da equipe técnica (mesmo de tecnico/estoque e
// tecnico/page.tsx) -- usado nas abas Estoque lojas e Estoque AT (Victor
// 27/10/2026).
export function TecnicoCabecalho({ titulo, subtitulo }: { titulo: string; subtitulo: string }) {
  return (
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
            <h1 className="font-bold text-lg text-white truncate">{titulo}</h1>
            <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.78)" }}>
              {subtitulo}
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
  );
}
