import { ComprasModalButton } from "./ComprasModalButton";

// Linha de cliente com botão "Ver compras" -- pedido do Victor 16/09/2026:
// deixar a tabela "muito parecida com a lógica" da tela de Entregas, que
// usa um botão "Ver produtos (N)" abrindo um modal em vez de expandir a
// linha. Antes essa linha expandia logo abaixo ao clicar no nome (pedido
// original do Victor 20/08/2026); a busca/apresentação das compras
// continua igual, só que em modal agora (ver ComprasModalButton.tsx).
export function ClienteHistoricoRow({
  clientId,
  name,
  leadingCells,
  // Total de compras já conhecido pelo chamador (quando existir) -- vira o
  // "(N)" no botão, mesmo padrão de ProductsModalButton (Entregas). Nem toda
  // tela tem esse número pronto de antemão (ex.: aba Status) -- nesse caso
  // o botão fica sem número, sem problema (o modal mostra a contagem certa
  // assim que carrega).
  comprasCount,
  // Cor do status/nível dessa linha (ver CLIENTE_STATUS_COLORS/
  // CLIENTE_NIVEL_COLORS) -- vira uma faixinha à esquerda do nome, pedido
  // do Victor 20/08/2026: "deixe a lista de clientes mais viva com cor,
  // borda... nada muito chamativo". Opcional pra não quebrar quem não
  // passar (fica sem faixa, comportamento de antes).
  accentColor,
  children,
}: {
  clientId: string;
  name: string;
  // Colunas ANTES do nome (ex.: "Posição" na visão Nível de relacionamento)
  // -- a maioria das tabelas não tem nenhuma, daí opcional.
  leadingCells?: React.ReactNode;
  comprasCount?: number;
  accentColor?: string;
  children: React.ReactNode;
}) {
  return (
    <tr className="transition-colors hover:bg-[var(--surface-2)]">
      {leadingCells}
      <td
        className="px-4 py-2 whitespace-nowrap"
        style={{
          color: "var(--text-primary)",
          boxShadow: accentColor ? `inset 3px 0 0 ${accentColor}` : undefined,
        }}
      >
        {/* whitespace-nowrap -- sem isso, essa é a única célula da linha
            sem nowrap, então é a única que quebra: com o resto da linha
            "empurrando" as colunas, o nome (às vezes bem longo) acaba
            espremido em várias linhas dentro de uma coluna estreita
            (achado 15/09/2026, aba Propensão a recompra). */}
        <span className="font-medium">{name}</span>
      </td>
      {children}
      <td className="px-4 py-2 whitespace-nowrap">
        <ComprasModalButton clientId={clientId} count={comprasCount} />
      </td>
    </tr>
  );
}
