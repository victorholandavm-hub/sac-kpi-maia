"use server";

import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabaseServer";

export type RedefinirSenhaFormState = { error?: string } | undefined;

// Completa o fluxo de "esqueci minha senha": troca o token do link de
// recuperação (gerado via admin.auth.admin.generateLink, type "recovery" --
// mesmo mecanismo de magic link já usado em establishAssistenciaIdentitySession,
// src/app/assistencia/actions.ts) por uma sessão real, e então a pessoa
// define a própria senha nova. Em nenhum momento o servidor vê/escolhe a
// senha -- só repassa pro Supabase Auth o que foi digitado no formulário.
export async function redefinirSenha(_state: RedefinirSenhaFormState, formData: FormData): Promise<RedefinirSenhaFormState> {
  const tokenHash = String(formData.get("token_hash") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!tokenHash) return { error: "Link inválido. Peça um novo." };
  if (password.length < 6) return { error: "A senha precisa ter pelo menos 6 caracteres." };

  const supabase = await getSupabaseServer();
  const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
  if (verifyError) return { error: "Link inválido ou expirado. Peça um novo." };

  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError) return { error: updateError.message };

  redirect("/assistencia/inicio");
}
