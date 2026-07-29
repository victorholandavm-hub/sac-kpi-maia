// Agrupa campos em cards com identidade visual consistente (mesma cor em
// todo lugar, a mesma já usada nos botões primários -- não uma cor por
// seção, pra não competir com o vocabulário de cor por status já usado no
// resto do app). `number` só faz sentido em formulários de preenchimento
// sequencial; páginas de leitura/ação (ex: detalhe de pedido) usam sem.
export function FormSection({
  title,
  number,
  hint,
  children,
}: {
  title: string;
  number?: number;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-lg border p-4 flex flex-col gap-4"
      style={{
        background: "color-mix(in srgb, var(--brand-green) 4%, var(--surface-1))",
        borderColor: "var(--border)",
        borderLeft: "4px solid var(--brand-green)",
      }}
    >
      <div className="flex items-center gap-2">
        {number ? (
          <span
            className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0"
            style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
          >
            {number}
          </span>
        ) : null}
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "var(--brand-green)" }}>
            {title}
          </h3>
          {hint ? (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {hint}
            </p>
          ) : null}
        </div>
      </div>
      {children}
    </div>
  );
}
