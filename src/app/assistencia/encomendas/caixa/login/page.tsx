import { redirect } from "next/navigation";
import { getCaixaSession } from "@/app/assistencia/caixa-actions";
import { CaixaLoginForm } from "@/components/assistencia/CaixaLoginForm";
import { LoginFormShell } from "@/components/assistencia/LoginFormShell";

export const dynamic = "force-dynamic";

export default async function CaixaLoginPage() {
  const existingSession = await getCaixaSession();
  if (existingSession) {
    redirect("/assistencia/encomendas/caixa");
  }

  return (
    <LoginFormShell roleTitle="Caixa — Encomendas" roleSubtitle="Digite seu nome e o seu PIN pra lançar um pedido." backHref="/assistencia/encomendas">
      <CaixaLoginForm />
    </LoginFormShell>
  );
}
