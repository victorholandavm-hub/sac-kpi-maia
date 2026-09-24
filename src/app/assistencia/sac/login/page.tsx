import { SacLoginForm } from "@/components/assistencia/SacLoginForm";
import { LoginFormShell } from "@/components/assistencia/LoginFormShell";

export const dynamic = "force-dynamic";

export default function SacLoginPage() {
  return (
    <LoginFormShell roleTitle="SAC" roleSubtitle="Entre com seu nome e PIN.">
      <SacLoginForm />
    </LoginFormShell>
  );
}
