import { redirect } from "next/navigation";
import { getLojaGerenteSession } from "@/app/assistencia/loja-actions";
import { LojaGerenteLoginForm } from "@/components/assistencia/LojaGerenteLoginForm";
import { LoginFormShell } from "@/components/assistencia/LoginFormShell";

export const dynamic = "force-dynamic";

export default async function LojaGerenteLoginPage() {
  const existingSession = await getLojaGerenteSession();
  if (existingSession) {
    redirect("/assistencia/loja");
  }

  return (
    <LoginFormShell roleTitle="Gerente de loja" roleSubtitle="Acompanhe a demanda em aberto e negocie prazos com a assistência.">
      <LojaGerenteLoginForm />
    </LoginFormShell>
  );
}
