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
// borderColor da aba ativa é var(--border) (a MESMA cor do trilho
// embaixo), não `color` -- correção do Victor 14/09/2026 (3ª rodada):
// "quero que a linha acompanhe a aba que está selecionada... a linha
// que está vindo de baixo, suba a partir do retangulo, rodeando o
// retangulo e desça novamente se juntando a linha de baixo". Com
// border-b-0 + rounded-t-lg + -mb-px (que já existiam), essa borda
// cinza sobe pelos dois lados e contorna o topo do quadrado preenchido,
// juntando visualmente com o border-b do trilho nas duas pontas -- só
// não passa embaixo da palavra (a própria borda de baixo foi removida),
// que é exatamente o "não precisa sublinhar a palavra" pedido por ele.
// Antes usava `color` (a cor de preenchimento), o que deixava a borda
// invisível (mesma cor do fundo) -- por isso parecia só "sumir" atrás
// do quadrado em vez de contornar.
export function UnderlineTab({ href, label, active, color = "var(--brand-green)" }: { href: string; label: string; active: boolean; color?: string }) {
  return (
    <Link
      href={href}
      className="text-sm font-medium px-4 py-2 -mb-px rounded-t-lg border border-b-0 transition-colors duration-200"
      style={{
        color: active ? "#fff" : "var(--text-secondary)",
        background: active ? color : "transparent",
        borderColor: active ? "var(--border)" : "transparent",
      }}
    >
      {label}
    </Link>
  );
}
