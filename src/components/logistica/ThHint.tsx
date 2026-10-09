import { HelpCircle } from "lucide-react";

// Cabeçalho de coluna com explicação -- antes era só um `title` solto no
// texto, sem nada indicando que tinha explicação pra ler (achado do
// Victor 09/10/2026: "textos cinzas explicativos flutuando na tela").
// Ícone "?" visível avisa que dá pra passar o mouse, mesmo tooltip nativo
// de sempre por trás (sem JS novo, sem popover pra manter). Sem hooks --
// renderiza igual em Server e Client Component (usado nas duas tabelas,
// uma de cada tipo).
export function ThHint({ children, hint }: { children: React.ReactNode; hint: string }) {
  return (
    <span className="inline-flex items-center gap-1" title={hint}>
      {children}
      <HelpCircle aria-hidden className="shrink-0" size={13} style={{ color: "var(--text-muted)" }} />
    </span>
  );
}
