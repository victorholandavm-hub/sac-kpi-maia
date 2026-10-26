import { redirect } from "next/navigation";
import { getCdSession } from "@/app/assistencia/cd-actions";
import { CdLoginForm } from "@/components/assistencia/CdLoginForm";
import { LoginFormShell } from "@/components/assistencia/LoginFormShell";

export const dynamic = "force-dynamic";

// Migrado pra LoginFormShell (antes reimplementava a mesma casca à mão, sem
// a pílula "Voltar") -- Design System unificado, pedido do Victor
// 18/10/2026. `backHref` aqui é "/assistencia/encomendas" (não o padrão
// "/assistencia", que seria o seletor de perfil errado pra quem está
// entrando como CD).
export default async function CdLoginPage() {
  const existingSession = await getCdSession();
  if (existingSession) {
    redirect("/assistencia/logistica/expedicao");
  }

  return (
    <LoginFormShell roleTitle="CD" roleSubtitle="Acompanhe e expeça os pedidos prontos pra saírem do centro de distribuição." backHref="/assistencia/encomendas">
      <CdLoginForm />
    </LoginFormShell>
  );
}
