import { redirect } from "next/navigation";
import { getMontadorSession } from "@/app/assistencia/montador-actions";
import { MontadorLoginForm } from "@/components/assistencia/MontadorLoginForm";
import { LoginFormShell } from "@/components/assistencia/LoginFormShell";

export const dynamic = "force-dynamic";

export default async function MontadorLoginPage() {
  const existingSession = await getMontadorSession();
  if (existingSession) {
    redirect("/assistencia/montador");
  }

  return (
    <LoginFormShell roleTitle="Montador" roleSubtitle="Veja seus próprios chamados de montagem, desmontagem e vistoria.">
      <MontadorLoginForm />
    </LoginFormShell>
  );
}
