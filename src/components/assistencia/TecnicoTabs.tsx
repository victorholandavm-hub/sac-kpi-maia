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
export function TecnicoTabs({ active }: { active: "fila" | "estoque" | "pecas" }) {
  return (
    <div className="flex items-center gap-2 border-b" style={{ borderColor: "var(--border)" }}>
      <UnderlineTab href="/assistencia/tecnico" label="Fila de classificação" active={active === "fila"} />
      <UnderlineTab href="/assistencia/tecnico/estoque" label="Estoque" active={active === "estoque"} />
      <UnderlineTab href="/assistencia/tecnico/pecas" label="Peças" active={active === "pecas"} />
    </div>
  );
}
