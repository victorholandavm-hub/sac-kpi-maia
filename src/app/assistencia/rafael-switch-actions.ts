"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCdSession } from "./cd-actions";
import { getFabricaSession } from "./fabrica-actions";
import { CD_COOKIE_NAME, CD_SESSION_MAX_AGE, signCdSession } from "@/lib/cdAuth";
import { FABRICA_COOKIE_NAME, FABRICA_SESSION_MAX_AGE, signFabricaSession } from "@/lib/fabricaAuth";

// Rafael é hoje o único que acumula os dois papéis (CD cobre fornecedor
// externo, fábrica cobre a produção própria -- ver dal.ts/admin). Trocar de
// papel normalmente exige sair e logar de novo com o PIN do outro lado; pra
// ele isso vira dois cliques porque a identidade já foi provada nessa mesma
// sessão -- assina a sessão do papel de destino direto, sem pedir PIN de
// novo. Restrito só ao nome dele por enquanto (não é uma troca-de-papel
// genérica): qualquer outro nome nessas duas sessões é ignorado.
const RAFAEL_NAME = "rafael";

export async function switchRafaelToFabrica() {
  const cdName = await getCdSession();
  if (!cdName || cdName.toLowerCase() !== RAFAEL_NAME) {
    redirect("/assistencia/encomendas");
  }

  const cookieStore = await cookies();
  cookieStore.delete({ name: CD_COOKIE_NAME, path: "/assistencia/encomendas" });
  cookieStore.set(FABRICA_COOKIE_NAME, signFabricaSession(cdName), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: FABRICA_SESSION_MAX_AGE,
    path: "/assistencia/encomendas",
  });

  redirect("/assistencia/encomendas/fila");
}

export async function switchRafaelToCd() {
  const fabricaName = await getFabricaSession();
  if (!fabricaName || fabricaName.toLowerCase() !== RAFAEL_NAME) {
    redirect("/assistencia/encomendas");
  }

  const cookieStore = await cookies();
  cookieStore.delete({ name: FABRICA_COOKIE_NAME, path: "/assistencia/encomendas" });
  cookieStore.set(CD_COOKIE_NAME, signCdSession(fabricaName), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: CD_SESSION_MAX_AGE,
    path: "/assistencia/encomendas",
  });

  redirect("/assistencia/encomendas/fila");
}
