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
