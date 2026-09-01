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
  // Tag de contorno fino -- Guia de Componentes Maia (Design System,
  // 01/09/2026): "selecionado = preenchimento sólido, não selecionado =
  // contorno fino cinza-200". A variante `color` (pills de status, cada
  // opção com a cor do próprio status) preenche com a cor semântica
  // daquele status quando selecionada -- útil pra bater o olho e achar
  // "Cancelada"/"Concluída" sem ler o texto -- em vez de forçar tudo pro
  // mesmo verde. A variante neutra (sem `color`) segue a regra à risca:
  // verde da marca quando selecionada, cinza-200 quando não.
  // Cor escurecida (color-mix com preto) pro texto -- alguns status (ex.
  // aberta, um amarelo claro) não têm contraste nenhum como texto cru
  // sobre branco (~1.9:1, bem abaixo do mínimo de leitura). Mistura preto
  // garante contraste em qualquer cor, sem precisar de exceção por
  // status; usada tanto no texto (não selecionado) quanto no
  // preenchimento sólido (selecionado, com texto branco em cima).
  const darkColor = color ? `color-mix(in srgb, ${color} 70%, black)` : undefined;
  const solidFill = color ? `color-mix(in srgb, ${color} 78%, black)` : undefined;
  return (
    <Link
      href={href}
      className="text-sm font-medium px-3.5 py-1.5 rounded-full whitespace-nowrap shrink-0 transition-colors duration-150"
      style={
        color
          ? {
              color: selected ? "#fff" : darkColor,
              background: selected ? solidFill : "#fff",
              border: `1px solid ${selected ? "transparent" : color}`,
            }
          : {
              color: selected ? "#fff" : "#4B5566",
              background: selected ? "#1B5E3C" : "#fff",
              border: `1px solid ${selected ? "transparent" : "#E5E7EB"}`,
            }
      }
    >
      {label}
    </Link>
  );
}
