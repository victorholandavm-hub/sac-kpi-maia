// Feedback de troca de tela -- pedido do Victor 02/09/2026: "praticamente
// todas as mudanças de tela estao demorando muito". Não existia NENHUM
// loading.tsx no app inteiro -- o Next.js só troca a tela quando a
// página nova (com todas as consultas em Promise.all já resolvidas)
// termina de renderizar no servidor, então a navegação parecia "travada"
// no meio do caminho, sem sinal nenhum de que algo estava acontecendo.
// Esse arquivo cobre TODAS as telas do grupo (app) de uma vez (fila,
// agenda, estoque, pagamentos, relatórios etc.) -- mais específico do
// que o loading.tsx geral (../loading.tsx), porque esse layout também
// tem consulta própria (getProfile) antes do cabeçalho/nav.
export default function Loading() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="h-8 w-8 rounded-full border-2 border-gray-200 animate-spin" style={{ borderTopColor: "#1B5E3C" }} aria-label="Carregando…" />
    </div>
  );
}
