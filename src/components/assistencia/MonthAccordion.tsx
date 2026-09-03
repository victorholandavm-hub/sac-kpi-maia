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
  // Agrupador cronológico -- Guia de Componentes Maia (Design System,
  // 01/09/2026): "fim das barras pretas gigantes gritando o nome do
  // mês... uma linha fina, tipografia limpa e um indicador numérico
  // discreto em formato de badge". Substitui a barra preta cheia
  // (background: var(--text-primary), texto branco caixa alta) que
  // existia antes. Rótulo do mês com "quadrado" (pílula branca com
  // sombra) + letra verde -- pedido do Victor 02/09/2026. Recolhido
  // fica assim; ABERTO (mostrando as semanas) inverte pra quadrado
  // VERDE + letra branca -- achado seguinte do Victor: "quando estiver
  // recolhido mantem do jeito que está, mas quando for aberto... deve
  // ficar com o quadrado verde e letras cinza ou branca" (mesmo
  // contraste do indicador ativo do segmented control Visitas/Entregas/
  // Agenda ao lado). `group-open/month:` -- mesmo mecanismo CSS puro que
  // já gira a seta ▶, sem precisar de estado/JS extra.
  return (
    <details open={defaultOpen} className="group/month flex flex-col gap-2">
      <summary className="flex items-center gap-3 py-1.5 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <span className="text-[10px] shrink-0 transition-transform duration-150 group-open/month:rotate-90 text-gray-400 dark:text-gray-500" aria-hidden="true">
          ▶
        </span>
        <span className="text-sm font-semibold uppercase tracking-wider whitespace-nowrap rounded-md shadow-sm px-2.5 py-1 bg-white dark:bg-gray-800 text-[#1B5E3C] group-open/month:bg-[#1B5E3C] group-open/month:text-white">
          {label}
        </span>
        <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-gray-100 dark:bg-gray-700 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
          {total}
        </span>
        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-600" />
      </summary>
      <div className="flex flex-col gap-3">{children}</div>
    </details>
  );
}
