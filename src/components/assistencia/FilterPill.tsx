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
  //
  // Revisado 03/09/2026 -- pedido do Victor: "ainda tem bastante cor forte
  // dos filtros e status... deixar menos dolorido aos olhos, já que é a
  // versão dark", confirmado com print da fileira Todas/Programado/Não
  // programado/Concluídas/Canceladas ("to falando dessa cores muito fortes
  // no dark"). Três correções: (1) fundo/borda/texto do pill NÃO
  // selecionado eram hex cru (#fff/#E5E7EB/#4B5566), sempre claros
  // independente do tema -- viravam um retângulo branco chapado boiando
  // no fundo escuro. Trocados pelos tokens (var(--surface-1)/var(--border)/
  // var(--text-secondary)), que já têm par escuro definido. (2) o texto do
  // pill colorido não selecionado misturava sempre com "black" (preto) --
  // certo no claro, errado no escuro (texto escuro em cima de fundo escuro
  // = sem contraste). Mistura agora com var(--foreground), que já inverte
  // sozinho por tema. (3) o preenchimento SÓLIDO do selecionado (pill
  // ativo) era sempre um bloco saturado + texto branco -- correto e
  // "chamativo de propósito" no claro, mas vira excesso de brilho/cor
  // crua boiando no fundo escuro suave que a gente acabou de ajustar.
  // `light-dark()` deixa o navegador escolher sozinho conforme o
  // `color-scheme` ativo (:root/.dark em globals.css): no claro continua
  // o bloco sólido de sempre; no escuro vira um tingido suave sobre o
  // card (mesma família visual do StatusBadge.tsx), preenchimento sólido
  // só reservado pro claro onde já funcionava bem.
  const darkColor = color ? `color-mix(in srgb, ${color} 70%, var(--foreground))` : undefined;
  const solidFill = color
    ? `light-dark(color-mix(in srgb, ${color} 78%, black), color-mix(in srgb, ${color} 24%, var(--surface-1)))`
    : undefined;
  const solidText = color ? `light-dark(#fff, color-mix(in srgb, ${color} 85%, var(--foreground)))` : undefined;
  return (
    <Link
      href={href}
      className="text-sm font-medium px-3.5 py-1.5 rounded-full whitespace-nowrap shrink-0 transition-colors duration-150"
      style={
        color
          ? {
              color: selected ? solidText : darkColor,
              background: selected ? solidFill : "var(--surface-1)",
              border: `1px solid ${selected ? "transparent" : color}`,
            }
          : {
              color: selected ? "light-dark(#fff, var(--text-primary))" : "var(--text-secondary)",
              background: selected ? "light-dark(#1B5E3C, color-mix(in srgb, #1B5E3C 26%, var(--surface-1)))" : "var(--surface-1)",
              border: `1px solid ${selected ? "transparent" : "var(--border)"}`,
            }
      }
    >
      {label}
    </Link>
  );
}
