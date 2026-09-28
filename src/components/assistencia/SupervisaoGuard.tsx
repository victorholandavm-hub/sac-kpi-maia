"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

// Papel "supervisao" (Akyla Thais, pedido do Victor 28/09/2026) só
// enxerga 4 telas (ver SupervisaoTabs.tsx) -- duas delas moram dentro do
// grupo (app), que também hospeda ~20 outras páginas (peças, pagamentos,
// admin, etc.) sem checagem de role própria, feitas pra qualquer
// perfil "assistencia"/"admin" autenticado. Em vez de auditar cada uma
// dessas páginas uma por uma, essa trava genérica cobre TODO o grupo de
// uma vez: qualquer rota fora da lista permitida manda de volta pra
// Estornos. É client-side (usePathname só existe em Client Component) --
// existe um flash breve do conteúdo da página errada antes do redirect;
// aceitável pro escopo desse papel (rota interna, sem dado voltado pro
// cliente final), mas não é proteção de servidor -- as 4 telas em si
// continuam checando o role no server component (ver financeiro/page.tsx,
// sac/notificacoes/page.tsx, reclamacoes/page.tsx).
const ALLOWED_PREFIXES = ["/assistencia/fila", "/assistencia/reclamacoes"];

export function SupervisaoGuard() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!ALLOWED_PREFIXES.some((p) => pathname.startsWith(p))) {
      router.replace("/assistencia/financeiro");
    }
  }, [pathname, router]);

  return null;
}
