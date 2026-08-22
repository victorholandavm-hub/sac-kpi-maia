import { bucketByScheduledDate, type DateBucketKey } from "./dateBuckets";
import type { PedidoEncomendaSummary } from "./pedidosEncomenda";

// Extraído de PedidoEncomendaFilaList.tsx (22/08/2026) -- a Visão Fábrica
// (FabricaProducaoView.tsx) precisa do mesmo agrupamento por prazo pra
// consolidar quantidade por produto dentro de cada data, então virou lib
// compartilhada em vez de duplicar a lógica.

// Agrupado por prazo (data que importa pra fila de verdade -- quando o
// pedido é esperado, não quando foi criado) -- pedido do Victor 20/08/2026:
// "deixe com a mesma organização que fizemos na tela dos admin... separado
// por data e organizado por ordem cronológica. Passou a data? vai lá pra
// baixo". "Prazo" aqui segue a mesma prioridade já exibida em cada card:
// prazo p/ loja (CD já confirmou) vence prazo p/ CD (fábrica ainda não
// despachou), que vence "sem prazo nenhum".
export function effectiveDeadline(p: PedidoEncomendaSummary): string | null {
  return p.prazoCdLoja ?? p.prazoFabricaCd ?? null;
}

export const NO_DEADLINE_KEY = "sem_prazo";

const DEADLINE_BUCKET_RANK: Record<DateBucketKey, number> = {
  hoje: 0,
  amanha: 1,
  depois: 2,
  atrasado: 3,
  sem_data: 4,
};

export type DeadlineGroup = { dateKey: string; label: string; pedidos: PedidoEncomendaSummary[] };

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
    const rankA = DEADLINE_BUCKET_RANK[bucketByScheduledDate(a.dateKey === NO_DEADLINE_KEY ? null : a.dateKey)];
    const rankB = DEADLINE_BUCKET_RANK[bucketByScheduledDate(b.dateKey === NO_DEADLINE_KEY ? null : b.dateKey)];
    if (rankA !== rankB) return rankA - rankB;
    return a.dateKey < b.dateKey ? -1 : a.dateKey > b.dateKey ? 1 : 0;
  });
  return groups;
}
