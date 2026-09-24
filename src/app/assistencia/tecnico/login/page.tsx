import { redirect } from "next/navigation";
import { getTecnicoSession } from "@/app/assistencia/tecnico-actions";
import { TecnicoLoginForm } from "@/components/assistencia/TecnicoLoginForm";
import { LoginFormShell } from "@/components/assistencia/LoginFormShell";

export const dynamic = "force-dynamic";

export default async function TecnicoLoginPage() {
  const existingSession = await getTecnicoSession();
  if (existingSession) {
    redirect("/assistencia/tecnico");
  }

  return (
    <LoginFormShell roleTitle="Equipe técnica" roleSubtitle="Chamados que voltaram com o motorista, com produto pra dar destino.">
      <TecnicoLoginForm />
    </LoginFormShell>
  );
}
