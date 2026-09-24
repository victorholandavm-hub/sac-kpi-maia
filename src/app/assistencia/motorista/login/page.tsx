import { redirect } from "next/navigation";
import { getDriverSession } from "@/app/assistencia/driver-actions";
import { MotoristaLoginForm } from "@/components/assistencia/MotoristaLoginForm";
import { LoginFormShell } from "@/components/assistencia/LoginFormShell";

export const dynamic = "force-dynamic";

export default async function MotoristaLoginPage() {
  const existingSession = await getDriverSession();
  if (existingSession) {
    redirect("/assistencia/motorista");
  }

  return (
    <LoginFormShell roleTitle="Motorista" roleSubtitle="Veja suas rotas de troca de produto e recolhimento.">
      <MotoristaLoginForm />
    </LoginFormShell>
  );
}
