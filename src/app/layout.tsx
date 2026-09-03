import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NavigationProgressBar } from "@/components/NavigationProgressBar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Painel de KPIs — SAC Maia",
  description: "Indicadores de atendimento do SAC Maia",
};

// Roda ANTES da hidratação (bloqueante, no <head>) -- pedido do Victor
// 02/09/2026 (modo noturno em todo o sistema). Sem isso, a página sempre
// nasceria clara (o React só saberia da preferência salva depois de
// montar) e um usuário com modo noturno escolhido veria um flash branco
// a cada navegação. Lê localStorage.theme; sem preferência salva, cai no
// prefers-color-scheme do sistema (primeira visita já nasce no tema
// certo, sem precisar abrir o app pra descobrir que existe a opção).
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    var dark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", dark);
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen flex flex-col">
        <NavigationProgressBar />
        {children}
      </body>
    </html>
  );
}
