import { LogOut } from "lucide-react";

// Sai de todos os perfis e volta pra tela "Quem está entrando?" (/assistencia/sair).
export function BotaoSair() {
  return (
    <form action="/assistencia/sair" method="post">
      <button
        type="submit"
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium"
        style={{ background: "var(--surface-2)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
      >
        <LogOut className="w-4 h-4" aria-hidden />
        Sair
      </button>
    </form>
  );
}
