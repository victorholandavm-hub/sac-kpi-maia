import { UnderlineTab } from "@/components/UnderlineTab";

// 3 abas da equipe técnica -- pedido do Victor 14/09/2026: "a tela da
// equipe técnica, que agora terá três abas: Fila de classificação,
// estoque e peças, fique desse jeito [aba sublinhada, quadrado verde +
// letra branca quando selecionada]" (mesmo componente/estilo já usado em
// Visitas/Entregas/Agenda, ver UnderlineTab.tsx). Substitui os links soltos
// que existiam antes no cabeçalho verde de cada tela (ver git blame de
// tecnico/page.tsx/tecnico/estoque/page.tsx) -- centralizado aqui porque
// as 3 páginas (Fila de Classificação, Estoque, e agora Peças) precisam
// mostrar exatamente a mesma fileira, só trocando qual está ativa.
// `active` vem de fora (cada página sabe qual é a sua) -- mais simples que
// tentar adivinhar pela URL aqui dentro. Peças passou a ser rota PRÓPRIA da
// equipe técnica (/assistencia/tecnico/pecas) em 14/09/2026 -- achado do
// Victor: "fica ruim se for compartilhada com a equipe tecnica a mesma
// tela da asisstencia" -- antes apontava pra /assistencia/pecas
// (compartilhada com assistência/admin, só o cabeçalho mudava).
// `pilula` (era sublinhado, sem essa prop) -- migração pro Design System
// unificado, pedido do Victor 18/10/2026: mesmo visual de pílula das outras
// navegações agora (AssistenciaNav/SacTabs/SupervisaoTabs/LojaTabs), sem o
// trilho `border-b` por baixo.
// "Estoque lojas" e "Estoque AT" -- Victor 27/10/2026; a "Estoque" de antes
// (baixa das retiradas de peça) virou "Baixa de retiradas" pra não confundir.
export function TecnicoTabs({ active }: { active: "fila" | "estoque" | "pecas" | "estoque-lojas" | "estoque-at" }) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto min-w-0 -mx-1 px-1 pb-1">
      <UnderlineTab href="/assistencia/tecnico" label="Fila de classificação" active={active === "fila"} pilula />
      <UnderlineTab href="/assistencia/tecnico/estoque" label="Baixa de retiradas" active={active === "estoque"} pilula />
      <UnderlineTab href="/assistencia/tecnico/estoque-lojas" label="Estoque lojas" active={active === "estoque-lojas"} pilula />
      <UnderlineTab href="/assistencia/tecnico/estoque-at" label="Estoque AT" active={active === "estoque-at"} pilula />
      <UnderlineTab href="/assistencia/tecnico/pecas" label="Peças" active={active === "pecas"} pilula />
    </div>
  );
}
