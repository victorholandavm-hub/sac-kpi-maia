// Título H1 + descrição + CTA no canto direito -- padrão único pras 3
// telas de operação (Agenda, Entregas/Fila, Solicitações), pedido do
// Victor 25/08/2026 ("guia de padronização"): "Todas as telas devem
// começar com o Título H1 alinhado à esquerda, seguido de uma breve
// descrição em texto cinza abaixo... botão principal de criação sempre
// fixado no canto superior direito". Não confundir com AssistenciaHeader
// (logo + "Assistência — Lojas Maia", identidade do app inteiro, um por
// layout) -- esse aqui é o título de CADA tela, renderizado abaixo dele.
export function PageHeader({ title, description, cta }: { title: string; description?: string; cta?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      {/* Guia de Componentes Maia (Design System, 01/09/2026): título em
          cinza-800 (nunca preto puro), descrição em cinza-500 -- mesma
          escala tipográfica da tela da equipe técnica. */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-gray-800">{title}</h1>
        {description ? <p className="text-sm text-gray-500">{description}</p> : null}
      </div>
      {cta}
    </div>
  );
}
