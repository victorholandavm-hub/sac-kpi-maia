import { groupByDeadline } from "@/lib/encomendaDeadline";
import type { PedidoEncomendaSummary } from "@/lib/pedidosEncomenda";

// Visão alternativa consolidada pra fábrica -- pedido do Victor 22/08/2026:
// "Crie um botão no topo [Alternar para Visão Fábrica] que consolida os
// itens por especificação técnica... A fábrica precisa ver o total do lote
// para corte e estofamento, enquanto o vendedor precisa ver a ordem por
// pedido individual". Puro reformato de leitura -- os MESMOS `pedidos` já
// filtrados (status/loja/fornecedor/busca) que a visão por pedido usa, só
// que aqui cada linha vira "N pedidos, QTD total" em vez de um card por
// pedido. Sem ação nenhuma aqui (marcar status etc. continua exigindo abrir
// o pedido) -- é uma tela de leitura pra planejar corte/estofamento, não
// mais uma superfície de clique.
type AggregatedLine = {
  key: string;
  produtoDescricao: string;
  produtoCodigo: string | null;
  totalQtd: number;
  pedidoNumbers: number[];
};

// Chave de agrupamento: código do produto quando existe (mais confiável,
// vem do TOTVS -- ver produto_codigo em pedidosEncomenda.ts), senão a
// descrição livre normalizada (trim + maiúsculas). Sem campo estruturado de
// medida/tecido no banco hoje (decisão do Victor 22/08/2026: não mexer no
// schema agora), então dois itens só juntam no mesmo lote se o texto for
// exatamente igual -- descrição digitada diferente não funde. É uma
// limitação real do texto livre, não um bug daqui.
function specKey(produtoCodigo: string | null, produtoDescricao: string): string {
  return (produtoCodigo?.trim() || produtoDescricao.trim()).toUpperCase();
}

function aggregateItemsBySpec(pedidos: PedidoEncomendaSummary[]): AggregatedLine[] {
  const byKey = new Map<string, AggregatedLine>();
  for (const p of pedidos) {
    for (const item of p.items) {
      const key = specKey(item.produtoCodigo, item.produtoDescricao);
      let line = byKey.get(key);
      if (!line) {
        line = { key, produtoDescricao: item.produtoDescricao, produtoCodigo: item.produtoCodigo, totalQtd: 0, pedidoNumbers: [] };
        byKey.set(key, line);
      }
      line.totalQtd += item.quantidade;
      if (!line.pedidoNumbers.includes(p.pedidoNumber)) line.pedidoNumbers.push(p.pedidoNumber);
    }
  }
  return [...byKey.values()].sort((a, b) => b.totalQtd - a.totalQtd);
}

export function FabricaProducaoView({ pedidos }: { pedidos: PedidoEncomendaSummary[] }) {
  const groups = groupByDeadline(pedidos);

  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => {
        const lines = aggregateItemsBySpec(group.pedidos);
        return (
          // Recolhido por padrão -- achado do Victor 24/08/2026: "toda vez
          // que eu entrar em qualquer tela, as demandas agrupadas precisam
          // aparecer recolhidas".
          <details key={group.dateKey} className="group flex flex-col gap-1.5">
            <summary className="flex items-center gap-2 px-1 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              <span className="inline-block transition-transform group-open:rotate-90" style={{ color: "var(--text-muted)" }}>
                ▶
              </span>
              <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                {group.label}
              </span>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                ({lines.length} {lines.length === 1 ? "item" : "itens"} · {group.pedidos.length} {group.pedidos.length === 1 ? "pedido" : "pedidos"})
              </span>
            </summary>
            <div className="rounded-lg overflow-hidden" style={{ background: "var(--surface-1)", border: "2px solid var(--brand-orange)" }}>
              <div className="divide-y" style={{ borderColor: "var(--brand-orange)" }}>
                {lines.map((line) => (
                  <div key={line.key} className="flex items-center gap-4 p-4 flex-wrap">
                    {/* Destaque técnico -- pedido do Victor 22/08/2026:
                        "Padronize o nome do produto destacando Quantidade...
                        em blocos distintos... evita erros na leitura rápida
                        na linha de produção". QTD bem grande (o número que
                        importa pro corte/estofamento em lote) + descrição em
                        negrito. Sem campo separado de medida/tecido no banco
                        (ver specKey acima) -- o texto da descrição já carrega
                        isso quando quem cadastrou digitou junto (ex: "Suede
                        Caramelo"), só não dá pra recortar em blocos
                        garantidamente certos sem mudar o schema. */}
                    <span
                      className="text-2xl font-extrabold shrink-0 rounded-lg px-3 py-1"
                      style={{ color: "#fff", background: "var(--brand-orange)" }}
                    >
                      {line.totalQtd}x
                    </span>
                    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                      <span className="text-base font-bold truncate" style={{ color: "var(--text-primary)" }}>
                        {line.produtoDescricao}
                      </span>
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {line.produtoCodigo ? `Código ${line.produtoCodigo} · ` : ""}
                        {line.pedidoNumbers.length === 1
                          ? `Pedido #${line.pedidoNumbers[0]}`
                          : `${line.pedidoNumbers.length} pedidos: ${line.pedidoNumbers.map((n) => `#${n}`).join(", ")}`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </details>
        );
      })}
    </div>
  );
}
