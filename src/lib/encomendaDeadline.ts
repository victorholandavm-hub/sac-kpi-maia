import type { PedidoEncomendaSummary } from "./pedidosEncomenda";

// Extraído de PedidoEncomendaFilaList.tsx (22/08/2026) -- a Visão Fábrica
// (FabricaProducaoView.tsx) precisa do mesmo agrupamento por prazo pra
// consolidar quantidade por produto dentro de cada data, então virou lib
// compartilhada em vez de duplicar a lógica.

// Agrupado por prazo (data que importa pra fila de verdade -- quando o
// pedido é esperado, não quando foi criado) -- "Prazo" aqui segue a mesma
// prioridade já exibida em cada card: prazo p/ loja (CD já confirmou) vence
// prazo p/ CD (fábrica ainda não despachou), que vence "sem prazo nenhum".
export function effectiveDeadline(p: PedidoEncomendaSummary): string | null {
  return p.prazoCdLoja ?? p.prazoFabricaCd ?? null;
}

export const NO_DEADLINE_KEY = "sem_prazo";

export type DeadlineGroup = { dateKey: string; label: string; pedidos: PedidoEncomendaSummary[] };

// Ordem cronológica pura (data mais antiga primeiro) -- pedido do Victor
// 22/08/2026: "essa organização de datas está ruim nessa tela, precisa
// voltar a ser por ordem cronologica mesma, em ordem por tempo ou seja quem
// pediu primeiro aparece primeiro". Existiu uma versão anterior que
// agrupava em baldes hoje/amanhã/depois/atrasado (mesmo padrão da aba
// Entregas) com "atrasado" jogado pro fim -- ficou ruim aqui porque
// misturava pedido de 12/08 (bem atrasado) depois de pedido de 04/09
// (bem no futuro), quebrando a leitura sequencial da fila. "Sem prazo
// definido" continua por último (não tem data pra ordenar de verdade).
// Lista única, sem agrupar por dia -- pedido do Victor 25/08/2026 (reforma
// da Fila de Encomendas): "Elimine a divisão de telas/visões separadas.
// Remova os blocos agrupadores por cada dia específico... Exiba uma lista
// única ordenada cronologicamente (do mais antigo/urgente para o mais
// recente)". Cronológica = prazo mais próximo/vencido primeiro (mesma
// direção de sempre, ver groupByDeadline acima) -- só não agrupa mais em
// blocos de `<details>` por dia, cada pedido vira uma linha direto.
// "Sem prazo definido" sai da lista principal (não fica "no fim da
// página" -- pedido do Victor: "não devem ficar no fim da página. Fixe um
// bloco de alerta no topo") -- essa função só devolve os DOIS grupos
// (fixo/resto), quem chama decide como renderizar cada um. Usado só pela
// visão "por pedido" (PedidoEncomendaFilaList.tsx) -- a Visão Fábrica
// (FabricaProducaoView.tsx) continua usando groupByDeadline: ali o
// agrupamento por dia tem função de verdade (planejar corte/estofamento
// por data de entrega), não é só navegação.
export function pinSemPrazoAndSort(pedidos: PedidoEncomendaSummary[]): { semPrazo: PedidoEncomendaSummary[]; comPrazo: PedidoEncomendaSummary[] } {
  const semPrazo = pedidos.filter((p) => !effectiveDeadline(p));
  const comPrazo = pedidos
    .filter((p) => effectiveDeadline(p))
    .sort((a, b) => (effectiveDeadline(a) as string).localeCompare(effectiveDeadline(b) as string));
  return { semPrazo, comPrazo };
}

export function groupByDeadline(pedidos: PedidoEncomendaSummary[]): DeadlineGroup[] {
  const groups: DeadlineGroup[] = [];
  for (const p of pedidos) {
    const deadline = effectiveDeadline(p);
    const dateKey = deadline ?? NO_DEADLINE_KEY;
    let group = groups.find((g) => g.dateKey === dateKey);
    if (!group) {
      const label = deadline
        ? new Date(`${deadline}T00:00:00Z`).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" })
        : "Sem prazo definido";
      group = { dateKey, label, pedidos: [] };
      groups.push(group);
    }
    group.pedidos.push(p);
  }
  groups.sort((a, b) => {
    if (a.dateKey === NO_DEADLINE_KEY) return b.dateKey === NO_DEADLINE_KEY ? 0 : 1;
    if (b.dateKey === NO_DEADLINE_KEY) return -1;
    return a.dateKey < b.dateKey ? -1 : a.dateKey > b.dateKey ? 1 : 0;
  });
  return groups;
}
