// Acordeão de mês -- pedido do Victor 28/08/2026: "quando fechar o mês,
// ela ficaria agrupada dentro do mês --> semana --> dia". Embrulha TODO
// mês que aparecer na tela (quando há mais de um -- ver
// `months.length === 1` em cada tela que usa isso, caso do mês único
// não ganha embrulho nenhum). Corrigido 29/08/2026: antes o mês corrente
// nunca ganhava esse embrulho (achado do Victor: "agosto precisa ficar
// do mesmo jeito que setembro, com as semanas dentro" -- só setembro
// tava com o visual certo, agosto ficava com semanas soltas, incluindo
// fragmentos de 1 dia só tipo "Semana de 31/08" quando a semana cruza
// pro mês seguinte). Agora todo mês usa o mesmo acordeão -- `defaultOpen`
// é o que diferencia: mês corrente nasce ABERTO (não esconde o que ainda
// tá em andamento atrás de mais um clique), os outros nascem fechados
// como todo acordeão dessa base. Sem hooks -- funciona igual em Server
// Component (fila/page.tsx, EntregasWeekGroups.tsx) e Client Component
// (AgendaDayGroups.tsx).
export function MonthAccordion({
  label,
  total,
  defaultOpen = false,
  children,
}: {
  label: string;
  total: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className="rounded-xl overflow-hidden group/month" style={{ border: "2px solid var(--text-primary)" }}>
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
