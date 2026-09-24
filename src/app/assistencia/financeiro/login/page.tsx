import { redirect } from "next/navigation";
import { getFinanceiroSession } from "@/app/assistencia/financeiro-actions";
import { FinanceiroLoginForm } from "@/components/assistencia/FinanceiroLoginForm";
import { LoginFormShell } from "@/components/assistencia/LoginFormShell";

export const dynamic = "force-dynamic";

export default async function FinanceiroLoginPage() {
  const existingSession = await getFinanceiroSession();
  if (existingSession) {
    redirect("/assistencia/financeiro");
  }

  return (
    <LoginFormShell roleTitle="Financeiro" roleSubtitle="Solicitações de estorno das lojas, pra processar e anexar o comprovante.">
      <FinanceiroLoginForm />
    </LoginFormShell>
  );
}
