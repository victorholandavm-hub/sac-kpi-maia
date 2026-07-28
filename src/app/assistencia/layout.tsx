import type { Metadata } from "next";

// Título/descrição do painel de KPIs (src/app/layout.tsx) não fazem sentido
// pra esse sistema -- mesmo repositório, mas é um produto totalmente
// diferente (deploy separado em assistencia-lojas-maia.vercel.app). Sem
// isso, qualquer link de /assistencia/* compartilhado (WhatsApp, etc.)
// mostra a prévia errada ("Painel de KPIs — SAC Maia").
export const metadata: Metadata = {
  title: "Sistema Integrado - Lojas Maia",
  description: "Solicitações, encomendas, agenda e equipe da assistência técnica.",
  openGraph: {
    title: "Sistema Integrado - Lojas Maia",
    description: "Solicitações, encomendas, agenda e equipe da assistência técnica.",
  },
};

export default function AssistenciaRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
