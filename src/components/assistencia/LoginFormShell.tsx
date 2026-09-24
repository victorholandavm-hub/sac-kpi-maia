import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

// Casca visual compartilhada pras telas de login -- pedido do Victor
// 24/09/2026 (redesenho "Tela 2"), aplicada primeiro em 2 exemplos reais
// (login por e-mail/senha do admin e por nome/PIN do financeiro) antes de
// estender pras outras 7. Cada tela continua com sua própria Server Action
// (PIN ou Supabase Auth, cada papel com o mecanismo que já tem hoje) -- só
// o visual em volta do formulário é compartilhado.
export function LoginFormShell({
  roleTitle,
  roleSubtitle,
  backHref = "/assistencia",
  children,
}: {
  roleTitle: string;
  roleSubtitle: string;
  backHref?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-sm w-full flex flex-col gap-6">
        <Link
          href={backHref}
          className="self-start inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors hover:border-[var(--brand-green)] hover:text-[var(--brand-green)]"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          <ArrowLeft size={14} /> Voltar para seleção de perfil
        </Link>

        <div className="flex flex-col items-center gap-3 text-center">
          <Image src="/logo.png" alt="Lojas Maia" width={225} height={225} className="h-16 w-16 object-contain" />
          <div>
            <h1 className="text-xl font-semibold" style={{ color: "var(--brand-green)" }}>
              Acessar como {roleTitle}
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              {roleSubtitle}
            </p>
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}

// Estilo de input compartilhado -- bordas nítidas + anel de foco visível
// (pedido explícito do Victor: "estados visíveis de focus").
export const loginInputClassName =
  "rounded-lg border px-3 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--brand-green)] focus:border-[var(--brand-green)]";
export const loginInputStyle = { borderColor: "var(--border)", background: "var(--surface-1)", color: "var(--text-primary)" };
