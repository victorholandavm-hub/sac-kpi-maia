import Image from "next/image";
import { ThemeToggle } from "@/components/ThemeToggle";

export function AssistenciaHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <header
      className="flex items-center justify-between gap-4 pb-4 flex-wrap"
      style={{ borderBottom: "3px solid var(--brand-orange)" }}
    >
      <div className="flex items-center gap-4">
        <Image src="/logo.png" alt="Lojas Maia" width={225} height={225} className="h-14 w-14 object-contain shrink-0" />
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--brand-green)" }}>
            {title}
          </h1>
          {subtitle ? (
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      {/* flex-wrap -- pedido do Victor 04/09/2026 ("ajustar a
          responsividade... o Antonio quer acessar via celular"): o
          cabeçalho inteiro (linha 15 acima) já quebrava linha entre
          logo/título e essa direita, mas essa direita em si não quebrava
          -- páginas que passam vários botões/links em `children` (ex.:
          Pagamentos: total/pago/pendente + exportar + nova) estouravam a
          largura da tela em celular. Compartilhado por ~25 telas (ver
          nota em (app)/layout.tsx) -- corrigir aqui vale pra todas de
          uma vez, sem risco: só muda alguma coisa quando não cabe. */}
      <div className="flex items-center gap-3 flex-wrap">
        <ThemeToggle />
        {children}
      </div>
    </header>
  );
}
