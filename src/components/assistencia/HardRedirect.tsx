"use client";

import { useEffect } from "react";

// redirect() do Next, quando disparado no meio de uma navegação client-side
// (Link ou redirect() de Server Action), ainda navega pelo router do
// cliente -- e é exatamente essa navegação suave que erra a rota aqui (ver
// reservedAssistenciaSlugs.ts). Trocar a URL na unha força um reload de
// verdade, que sempre resolve certo.
export function HardRedirect({ to }: { to: string }) {
  useEffect(() => {
    window.location.href = to;
  }, [to]);
  return null;
}
