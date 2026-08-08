// Linha de progresso horizontal -- "onde o chamado/pedido está" de relance,
// sem precisar ler o texto do status. Só serve pro caminho "feliz" (sequência
// linear); estados terminais fora dessa sequência (cancelada, negado) ou
// exceções (remarcar) são decisão de quem chama -- ver comentário em cada
// tela que usa isso.
export function StatusStepper({ steps, currentKey }: { steps: { key: string; label: string }[]; currentKey: string }) {
  const currentIndex = steps.findIndex((s) => s.key === currentKey);

  return (
    <div className="flex items-start w-full overflow-x-auto py-1">
      {steps.map((step, i) => {
        const done = currentIndex >= 0 && i < currentIndex;
        const active = i === currentIndex;
        return (
          <div key={step.key} className="flex items-start flex-1 min-w-[84px]">
            <div className="flex flex-col items-center gap-1 shrink-0" style={{ width: 84 }}>
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{
                  background: active
                    ? "var(--brand-green)"
                    : done
                      ? "var(--status-good)"
                      : "color-mix(in srgb, var(--text-secondary) 20%, var(--surface-1))",
                  color: active || done ? "#fff" : "var(--text-muted)",
                }}
              >
                {done ? "✓" : i + 1}
              </div>
              <span
                className="text-[10px] text-center leading-tight"
                style={{ color: active ? "var(--text-primary)" : "var(--text-muted)", fontWeight: active ? 700 : 400 }}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 ? (
              <div className="h-0.5 flex-1 mt-3" style={{ background: done ? "var(--status-good)" : "var(--border)" }} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
