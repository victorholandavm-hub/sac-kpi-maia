// Agrupa campos em cards com identidade visual consistente. Neutro por
// padrão (nada de fundo colorido nem borda de destaque em toda seção --
// já rendeu reclamação de "cor demais" quando aplicado em bloco atrás de
// bloco) -- hierarquia vem do peso do título (preto, negrito), não de cor.
// `number` (bolinha verde) é a única cor daqui, e só faz sentido em
// formulários de preenchimento sequencial; páginas de leitura/ação (ex:
// detalhe de pedido) usam sem.
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
      style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
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
          <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
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
