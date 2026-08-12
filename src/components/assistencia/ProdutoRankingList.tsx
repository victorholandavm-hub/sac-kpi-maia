import Link from "next/link";
import type { ProdutoRankingItem, ProdutoSaldoEstoque, ProdutoTendencia } from "@/lib/vendasProduto";
import { RUNWAY_DIAS_ALERTA } from "@/lib/vendasProduto";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Seta + percentual comparando as últimas 12 semanas de venda desse produto
// com as 12 anteriores -- sinal rápido de "esquentando/esfriando" pro
// comprador da loja, sem precisar abrir a curva individual do produto. Sem
// indicador quando não há base de comparação (variacaoPct null).
function TendenciaBadge({ tendencia }: { tendencia: ProdutoTendencia | undefined }) {
  if (!tendencia || tendencia.variacaoPct === null) return null;
  const { variacaoPct } = tendencia;
  if (variacaoPct === 0) {
    return (
      <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
        ▬ 0%
      </span>
    );
  }
  const subindo = variacaoPct > 0;
  return (
    <span
      className="text-xs font-semibold whitespace-nowrap"
      style={{ color: subindo ? "var(--status-good)" : "var(--status-critical)" }}
      title="Comparado às 12 semanas anteriores"
    >
      {subindo ? "▲" : "▼"} {Math.abs(variacaoPct)}%
    </span>
  );
}

// "Comprador precisa mandar rodar esse lote AGORA" -- pisca de propósito
// (mesmo animate-pulse já usado pra alerta urgente em assistencia/sac,
// ver src/app/assistencia/sac/page.tsx), só aparece quando o saldo do CD
// esgota antes de RUNWAY_DIAS_ALERTA dias no ritmo de venda atual.
function RupturaTag({ diasDeCobertura }: { diasDeCobertura: number }) {
  const dias = Math.max(0, Math.ceil(diasDeCobertura));
  return (
    <span
      className="text-xs font-bold px-2 py-1 rounded animate-pulse inline-block"
      style={{ background: "var(--status-critical)", color: "#fff" }}
    >
      [ RUPTURA EM {dias} DIA{dias === 1 ? "" : "S"} ]
    </span>
  );
}

export function ProdutoRankingList({
  items,
  title,
  productHref,
  tendencias,
  saldos,
}: {
  items: ProdutoRankingItem[];
  title: string;
  productHref: (productCode: string) => string;
  tendencias?: Map<string, ProdutoTendencia>;
  saldos?: Map<string, ProdutoSaldoEstoque>;
}) {
  return (
    <div className="rounded-lg overflow-hidden" style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}>
      <h3 className="text-sm font-bold p-4 pb-2" style={{ color: "var(--text-primary)" }}>
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-sm px-4 pb-4" style={{ color: "var(--text-muted)" }}>
          Nenhuma venda encontrada nesse período/tipo.
        </p>
      ) : (
        <div className="divide-y" style={{ borderColor: "var(--gridline)" }}>
          {items.map((item, i) => {
            const saldo = saldos?.get(item.productCode);
            const emRuptura = saldo?.diasDeCobertura !== null && saldo?.diasDeCobertura !== undefined && saldo.diasDeCobertura < RUNWAY_DIAS_ALERTA;
            return (
              <Link key={item.productCode} href={productHref(item.productCode)} className="flex flex-col hover:opacity-80">
                <div className="flex items-center gap-3 p-3">
                  <span
                    className="text-sm font-bold shrink-0 w-6 text-center"
                    style={{ color: i < 3 ? "var(--brand-green)" : "var(--text-muted)" }}
                  >
                    {i + 1}
                  </span>
                  <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                    <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                      {item.description ?? "(sem descrição)"}
                    </span>
                    <span className="text-xs flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
                      <span className="font-mono">#{item.productCode}</span>
                      <span
                        className="px-1.5 py-0.5 rounded-full"
                        style={{ background: "var(--gridline)", color: "var(--text-secondary)" }}
                      >
                        {item.categoria.label}
                      </span>
                    </span>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <span className="text-sm font-bold flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}>
                      {item.quantidade} un
                      <TendenciaBadge tendencia={tendencias?.get(item.productCode)} />
                    </span>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {formatBRL(item.valor)}
                    </span>
                    {saldo ? (
                      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                        Disponível: {saldo.saldoAtual} un
                      </span>
                    ) : null}
                  </div>
                </div>
                {emRuptura ? (
                  <div className="px-3 pb-2.5 -mt-1">
                    <RupturaTag diasDeCobertura={saldo!.diasDeCobertura!} />
                  </div>
                ) : null}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
