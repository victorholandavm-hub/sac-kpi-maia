// Mesmo motivo/pedido do loading.tsx de (app) -- cobre as 9 telas do
// domínio SAC (sac/page.tsx e as rotas abaixo dela) de uma vez só, já
// que ficam fora do grupo (app) de propósito (ver AGENTS.md/plano). Mais
// específico do que o loading.tsx geral (../loading.tsx) porque cada
// página do SAC faz consulta própria -- não muda nada visualmente (é o
// mesmo componente), só existe pra deixar claro que o SAC não depende
// do fallback genérico de cima.
export default function Loading() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="h-8 w-8 rounded-full border-2 border-gray-200 animate-spin" style={{ borderTopColor: "#1B5E3C" }} aria-label="Carregando…" />
    </div>
  );
}
