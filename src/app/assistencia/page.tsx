import Link from "next/link";

export default function AssistenciaHomePage() {
  return (
    <div className="max-w-md mx-auto p-6 mt-20 flex flex-col gap-8 text-center">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: "var(--brand-green)" }}>
          Assistência — Lojas Maia
        </h1>
        <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>
          Quem está entrando?
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <Link
          href="/assistencia/loja"
          className="rounded-lg border p-5 flex flex-col gap-1 hover:opacity-80"
          style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
        >
          <span className="text-base font-medium" style={{ color: "var(--text-primary)" }}>
            Gerente de loja
          </span>
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>
            Solicitar assistência e ver a demanda em aberto
          </span>
        </Link>

        <Link
          href="/assistencia/login"
          className="rounded-lg border p-5 flex flex-col gap-1 hover:opacity-80"
          style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
        >
          <span className="text-base font-medium" style={{ color: "var(--text-primary)" }}>
            Equipe assistência
          </span>
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>
            Login individual para gerenciar a fila
          </span>
        </Link>
      </div>
    </div>
  );
}
