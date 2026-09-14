import { redirect } from "next/navigation";
import { getOptionalProfile } from "./dal";
import { getTecnicoSession } from "@/app/assistencia/tecnico-actions";

// Quem pode mexer em pedido de peça (/assistencia/pecas) -- pedido do
// Victor 14/09/2026: "preciso agora que a aba peça, de controle
// assistencia, tambem apareça para a equipe técnica" + "acesso completo,
// igual assistencia". Dois sistemas de login TOTALMENTE diferentes por
// trás: assistência/admin são Profile (Supabase Auth, ver dal.ts);
// equipe técnica é sessão por PIN (cookie próprio, ver tecnicoAuth.ts/
// tecnico-actions.ts), sem usuário Supabase Auth nenhum. `actor.name` já
// vem pronto pro que cada action grava (requested_by, changed_by de
// histórico etc.) -- quem chama não precisa saber qual dos dois é, só
// usar `actor.name`/`actor.role`.
export type PecasActor = { name: string; role: "assistencia" | "admin" | "tecnico" };

// Pra usar dentro de Server Actions (pecas-actions.ts) -- lança em vez de
// redirecionar (ações não redirecionam sozinhas, quem chama trata o erro
// via useQuickAction/toast, mesmo padrão de requireRole em dal.ts).
export async function requirePecasActor(): Promise<PecasActor> {
  const profile = await getOptionalProfile();
  if (profile && (profile.role === "assistencia" || profile.role === "admin")) {
    return { name: profile.fullName, role: profile.role };
  }
  const tecnicoName = await getTecnicoSession();
  if (tecnicoName) {
    return { name: tecnicoName, role: "tecnico" };
  }
  throw new Error("Sessão expirada. Faça login de novo.");
}

// Pra usar no layout de /assistencia/pecas (Server Component, pode
// redirecionar) -- decide ALI se a pessoa é um Profile (renderiza o
// cabeçalho normal de assistência) ou a equipe técnica (renderiza o
// cabeçalho verde + 3 abas próprias dela, ver pecas/layout.tsx). SAC tem
// Profile válido mas não pode entrar aqui (mesmo redirectIfSac de sempre)
// -- perde pro `profile` genérico, cai no "nem um nem outro" e volta pro
// login, sem precisar de um caso à parte.
export async function requirePecasViewer(): Promise<{ profile: Awaited<ReturnType<typeof getOptionalProfile>>; tecnicoName: string | null }> {
  const profile = await getOptionalProfile();
  if (profile && (profile.role === "assistencia" || profile.role === "admin")) {
    return { profile, tecnicoName: null };
  }
  const tecnicoName = await getTecnicoSession();
  if (tecnicoName) {
    return { profile: null, tecnicoName };
  }
  redirect("/assistencia/login");
}
