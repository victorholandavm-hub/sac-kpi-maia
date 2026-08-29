// Acordeão de mês -- pedido do Victor 28/08/2026: "quando fechar o mês,
// ela ficaria agrupada dentro do mês --> semana --> dia". Só embrulha os
// meses já FECHADOS (ver isCurrentMonth, weekGrouping.ts) -- o mês
// corrente continua mostrando semana > dia direto (ver cada tela que usa
// isso: fila/page.tsx, EntregasWeekGroups.tsx, AgendaDayGroups.tsx),
// sem esse nível a mais escondendo o que ainda tá em andamento atrás de
// mais um clique. Recolhido por padrão, como todo acordeão dessa base.
// Sem hooks -- funciona igual em Server Component (fila/page.tsx,
// EntregasWeekGroups.tsx) e Client Component (AgendaDayGroups.tsx).
export function MonthAccordion({ label, total, children }: { label: string; total: number; children: React.ReactNode }) {
  return (
    <details className="rounded-xl overflow-hidden group/month" style={{ border: "2px solid var(--text-primary)" }}>
      <summary
        className="px-4 py-2.5 flex items-center gap-2 flex-wrap cursor-pointer list-none [&::-webkit-details-marker]:hidden"
        style={{ background: "var(--text-primary)" }}
      >
        <span
          className="text-xs shrink-0 transition-transform duration-150 group-open/month:rotate-90"
          style={{ color: "var(--surface-1)" }}
          aria-hidden="true"
        >
          ▶
        </span>
        <span className="text-base font-extrabold uppercase tracking-wide" style={{ color: "var(--surface-1)" }}>
          {label}
        </span>
        <span className="text-xs font-semibold" style={{ color: "var(--surface-1)", opacity: 0.8 }}>
          ({total})
        </span>
      </summary>
      <div className="flex flex-col gap-3 p-3" style={{ background: "var(--surface-2)" }}>
        {children}
      </div>
    </details>
  );
}
