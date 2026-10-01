"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCdSession } from "./cd-actions";
import { getFabricaSession } from "./fabrica-actions";
import { CD_COOKIE_NAME, CD_SESSION_MAX_AGE, signCdSession } from "@/lib/cdAuth";
import { FABRICA_COOKIE_NAME, FABRICA_SESSION_MAX_AGE, signFabricaSession } from "@/lib/fabricaAuth";
import { DUAL_ROLE_NAMES } from "@/lib/assistenciaLabels";

// Rafael e Eduardo acumulam os dois papéis (CD cobre fornecedor externo,
// fábrica cobre a produção própria -- ver dal.ts/admin) -- pedido do Victor
// 01/10/2026: "o acesso de Eduardo do CD, tenha as mesmas permissões do
// acesso de Rafael, para poder acessar a fabrica tambem", mesmo esquema que
// o Rafael já tinha. Trocar de papel normalmente exige sair e logar de novo
// com o PIN do outro lado; pra quem está nessa lista isso vira dois
// cliques, porque a identidade já foi provada nessa mesma sessão -- assina
// a sessão do papel de destino direto, sem pedir PIN de novo. Restrito a
// essa lista por nome (não é uma troca-de-papel genérica pra todo mundo):
// qualquer outro nome nessas duas sessões é ignorado. DUAL_ROLE_NAMES mora
// em assistenciaLabels.ts (não aqui) -- esse arquivo é "use server", e esse
// tipo de arquivo só pode exportar funções async (um array quebra o build).

export async function switchRafaelToFabrica() {
  const cdName = await getCdSession();
  if (!cdName || !DUAL_ROLE_NAMES.includes(cdName.toLowerCase())) {
    redirect("/assistencia/encomendas");
  }

  const cookieStore = await cookies();
  // Só o path novo -- ver comentário em cd-actions.ts (cdSignOut):
  // cookies() do Next só emite UM Set-Cookie por nome de cookie por
  // resposta, chamar .delete() duas vezes pro mesmo nome faz a segunda
  // sobrescrever a primeira (era exatamente esse o motivo do Rafael
  // continuar resolvendo como "cd" depois de trocar pra fábrica).
  cookieStore.delete({ name: CD_COOKIE_NAME, path: "/assistencia" });
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
  if (!fabricaName || !DUAL_ROLE_NAMES.includes(fabricaName.toLowerCase())) {
    redirect("/assistencia/encomendas");
  }

  const cookieStore = await cookies();
  cookieStore.delete({ name: FABRICA_COOKIE_NAME, path: "/assistencia/encomendas" });
  // path "/assistencia" -- mesmo motivo do cd-actions.ts (cdSignIn):
  // /assistencia/fornecedores também lê essa sessão, e um path estreito não
  // chega lá. Esse switcher setava no path antigo ("/assistencia/encomendas"),
  // então o CD do Rafael por aqui nunca alcançava fornecedores.
  cookieStore.set(CD_COOKIE_NAME, signCdSession(fabricaName), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: CD_SESSION_MAX_AGE,
    path: "/assistencia",
  });

  redirect("/assistencia/encomendas/fila");
}
