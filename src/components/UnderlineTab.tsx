import Link from "next/link";

// Aba sublinhada -- pedido do Victor 14/09/2026: "quero que [Visitas/
// Entregas/Agenda] e [SAC/Assistência] fiquem iguais a [Geral e
// Volumetria/Performance da Equipe/Gargalos e Logística]... a unica
// diferença é que o quadrado que estivesse selecionado, deveria ficar
// verde com letras brancas". Mesma estrutura de Dashboard.tsx (TABS,
// painel de KPIs geral) -- ativa "flutua" sobre a linha (-mb-px cobre o
// border-b do trilho, rounded-t-lg só em cima); só o preenchimento da
// aba ativa muda (verde sólido + branco, não branco + texto verde como
// em Dashboard.tsx) -- pedido explícito depois de duas rodadas testando
// outras variações (aba sem quadrado nenhum, depois pill arredondado
// cheio) que não bateram com o que ele queria. Extraído aqui porque
// passou a se repetir em 3 lugares (fila/page.tsx, agenda/page.tsx,
// KpisSectionTabs.tsx) com a MESMA receita -- reescrever à mão de novo
// cada vez que o estilo mudar (já mudou duas vezes hoje) é receita
// pra divergir.
//
// `color` opcional (default verde) -- pedido do Victor 14/09/2026
// (revisão no mesmo dia): "esse, dos kpis pode deixar a cor laranja
// mesmo, nao verde" -- KpisSectionTabs.tsx já usava laranja antes de
// virar essa aba sublinhada (paleta própria do painel de KPIs, ver
// AppHeader.tsx), só a estrutura mudou, a cor da aba ativa continua
// sendo a "identidade" de cada tela que usa esse componente.
//
// borderColor da aba ativa contorna o quadrado preenchido -- correção do
// Victor 14/09/2026 (3ª rodada): "quero que a linha acompanhe a aba que
// está selecionada... a linha que está vindo de baixo, suba a partir do
// retangulo, rodeando o retangulo e desça novamente se juntando a linha
// de baixo". Com border-b-0 + rounded-t-lg + -mb-px (que já existiam),
// essa borda sobe pelos dois lados e contorna o topo do quadrado
// preenchido, juntando visualmente com o border-b do trilho nas duas
// pontas -- só não passa embaixo da palavra (a própria borda de baixo foi
// removida), que é exatamente o "não precisa sublinhar a palavra" pedido
// por ele.
//
// var(--text-muted), não var(--border) -- 2ª correção, mesmo dia
// ("ainda nao tem a linha"): var(--border) é cinza a 10% de opacidade
// (pensado pra divisória sutil sobre fundo neutro), contra o preenchimento
// verde sólido isso é praticamente invisível numa tela normal -- por isso
// a borda "sumia" de novo, mesmo já sendo uma cor diferente do
// preenchimento. var(--text-muted) é opaco (cinza médio de verdade),
// contrasta tanto contra o verde quanto contra o fundo claro/escuro da
// página.
export function UnderlineTab({ href, label, active, color = "var(--brand-green)" }: { href: string; label: string; active: boolean; color?: string }) {
  return (
    <Link
      href={href}
      className="text-sm font-medium px-4 py-2 -mb-px rounded-t-lg border border-b-0 transition-colors duration-200"
      style={{
        color: active ? "#fff" : "var(--text-secondary)",
        background: active ? color : "transparent",
        borderColor: active ? "var(--text-muted)" : "transparent",
      }}
    >
      {label}
    </Link>
  );
}
