import Link from "next/link";

// Pill de filtro rápido -- pedido do Victor 25/08/2026 ("guia de
// padronização"): "Linha 1 (Filtros Rápidos por Status): Botões estilo
// Pill/Badge... exata mesma barra de ferramentas" nas 3 telas de
// operação. Extraído do estilo que já existia repetido (idêntico, mas
// copiado) em fila/page.tsx, sac/notificacoes/page.tsx e agenda/page.tsx
// -- centralizando aqui garante que os pills continuam iguais nas 3
// telas, em vez de divergir aos poucos como as cópias já tinham feito
// antes (ver EntregasGroupsList.tsx/groupByRota, mesmo motivo).
//
// Duas variantes, mesmas que já existiam:
// - `color` presente: pill "colorido" (usado nos filtros de status, cada
//   opção com sua cor -- ex. ENTREGA_FILTERS/FILTERS).
// - `color` ausente: pill "neutro" (usado em filtros sem cor própria --
//   ex. Origem/Cidade antes de virarem dropdown, Tipo de solicitação,
//   rotas da Agenda, alternância Por dia/Por montador).
export function FilterPill({
  href,
  label,
  selected,
  color,
}: {
  href: string;
  label: string;
  selected: boolean;
  color?: string;
}) {
  return (
    <Link
      href={href}
      className="text-xs px-3 py-1 rounded-full whitespace-nowrap shrink-0"
      style={
        color
          ? {
              color: "var(--text-primary)",
              background: selected ? `color-mix(in srgb, ${color} 35%, var(--surface-1))` : "transparent",
              fontWeight: selected ? 600 : 400,
              border: `1px solid ${selected ? "transparent" : `color-mix(in srgb, ${color} 40%, transparent)`}`,
            }
          : {
              border: "1px solid var(--border)",
              background: selected ? "var(--surface-1)" : "transparent",
              color: selected ? "var(--text-primary)" : "var(--text-secondary)",
              fontWeight: selected ? 600 : 400,
            }
      }
    >
      {label}
    </Link>
  );
}
