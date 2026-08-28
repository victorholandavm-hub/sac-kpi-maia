import Link from "next/link";
import { getProfile } from "@/lib/dal";
import {
  searchProdutosEstoque,
  getProdutoPrazo,
  listProdutosComPedidoDeCompra,
  RUNWAY_DIAS_ALERTA,
  type ProdutoSugestao,
} from "@/lib/vendasProduto";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";
import { StatTile } from "@/components/StatTile";

export const dynamic = "force-dynamic";

function formatDateBr(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR");
}

function buildHref(q?: string) {
  return q ? `/assistencia/prazos-produtos?q=${encodeURIComponent(q)}` : "/assistencia/prazos-produtos";
}

// "Prazos de produtos" -- pedido do Victor 27/08/2026: "preciso de uma
// nova aba para admin, assistencia e sac... coloque tudo lá" -- movido de
// dentro do card de curva em /vendas (senha de painel de KPIs, que nem
// todo assistência/SAC tem) pra dentro do sistema de assistência, com o
// login por papel de sempre (getProfile/requireRole). Mesmo padrão de
// acesso liberado pros 3 papéis de despacho-lote/page.tsx (canView), sem
// redirectIfSac.
export default async function PrazosProdutosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const profile = await getProfile();
  const canView = profile.role === "assistencia" || profile.role === "admin" || profile.role === "sac";
  if (!canView) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Acesso restrito.
      </p>
    );
  }

  const { q } = await searchParams;
  const query = (q ?? "").trim();

  let produto = query ? await getProdutoPrazo(query) : null;
  let sugestoes: ProdutoSugestao[] = [];
  if (query && !produto) {
    sugestoes = await searchProdutosEstoque(query);
    if (sugestoes.length === 1) {
      produto = await getProdutoPrazo(sugestoes[0].productCode);
      sugestoes = [];
    }
  }

  const pendentes = await listProdutosComPedidoDeCompra();

  return (
    <div className="flex flex-col gap-6">
      <AssistenciaHeader title="Prazos de produtos" subtitle="Saldo no CD e previsão de chegada, direto do Protheus (produto padrão de catálogo, não encomenda)." />

      {/* Aviso sobre a limitação real da API do Protheus -- pedido do
          Victor 28/08/2026, depois de achar um produto (Roupeiro Domo)
          com "Em pedido" divergente do que ele via direto no Protheus.
          Causa raiz (documentada em APIs/totvs8.md, endpoint WSStock):
          "estimatedQty, purchaseOrderBalance e estimatedArrivalDate vêm
          do primeiro pedido de compra em aberto do produto (menor
          C7_NUM)" -- se o produto tiver mais de um pedido de compra
          aberto ao mesmo tempo, só o mais antigo aparece aqui, os outros
          somem (a API não soma nem lista todos -- não tem outro
          endpoint que traga isso). Não é bug do nosso sync, é limitação
          da API -- "deixe o aviso, já que você nao consegue mostrar
          todos". */}
      <p className="text-xs rounded-lg px-3 py-2" style={{ background: "var(--brand-orange-soft)", color: "var(--text-secondary)" }}>
        ⚠ &quot;Em pedido de compra&quot; e &quot;Previsão de chegada&quot; mostram só o <strong>primeiro</strong> pedido de compra em
        aberto do produto (o mais antigo) -- limitação da API do Protheus, não soma nem lista os outros. Se o produto tiver mais de
        um pedido aberto ao mesmo tempo, o número daqui pode ficar menor que o total real no Protheus.
      </p>

      <form action="/assistencia/prazos-produtos" method="GET" className="flex items-center gap-2 flex-wrap">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Código ou nome do produto…"
          className="rounded border px-3 py-2 text-sm flex-1 min-w-[240px]"
          style={{ borderColor: "var(--border)" }}
        />
        <button
          type="submit"
          className="text-sm px-3 py-2 rounded font-medium"
          style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
        >
          Buscar
        </button>
        {query ? (
          <Link href={buildHref()} className="text-xs underline" style={{ color: "var(--text-secondary)" }}>
            Limpar busca
          </Link>
        ) : null}
      </form>

      {query && !produto && sugestoes.length === 0 ? (
        <div className="rounded-lg border p-6 text-center" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Nenhum produto encontrado pra &quot;{query}&quot;.
          </p>
        </div>
      ) : null}

      {sugestoes.length > 1 ? (
        <div className="rounded-lg p-4 flex flex-col gap-2" style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Vários produtos batem com &quot;{query}&quot; — escolha um:
          </p>
          {sugestoes.map((s) => (
            <Link key={s.productCode} href={buildHref(s.productCode)} className="text-sm hover:underline" style={{ color: "var(--text-primary)" }}>
              {s.description ?? "(sem descrição)"}{" "}
              <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                #{s.productCode}
              </span>
            </Link>
          ))}
        </div>
      ) : null}

      {produto ? (
        <div className="rounded-lg p-4 flex flex-col gap-3" style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}>
          <div>
            <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
              #{produto.productCode}
            </span>
            <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
              {produto.description ?? "Produto sem descrição"}
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatTile label="Saldo no CD" value={produto.saldoAtual} suffix="un" accent="var(--series-1)" />
            {/* Disponível = saldo atual - reservado (vendas já feitas) --
                pedido do Victor 28/08/2026: "qtd. disponivel é o que tem
                disponivel... qtd de reserva - qtd atual = qtd disponivel"
                (fórmula com a ordem invertida no pedido, aplicada aqui na
                ordem que bate com o significado -- atual menos o que já
                foi vendido). Pode ficar negativo (produto vendido além do
                saldo físico) -- sinal real pro comprador, sem esconder. */}
            <StatTile label="Disponível" value={produto.saldoDisponivel} suffix="un" accent="var(--series-5)" />
            {produto.saldoEmPedidoCompra !== null ? (
              <StatTile label="Em pedido de compra" value={produto.saldoEmPedidoCompra} suffix="un" accent="var(--series-4)" />
            ) : null}
            {produto.previsaoChegada ? (
              <StatTile label="Previsão de chegada" value={formatDateBr(produto.previsaoChegada)} accent="var(--brand-orange)" />
            ) : null}
          </div>
          {produto.saldoEmPedidoCompra === null && !produto.previsaoChegada ? (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Sem pedido de compra em aberto pra esse produto agora.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-lg overflow-hidden" style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}>
        <h3 className="text-sm font-bold p-4 pb-2" style={{ color: "var(--text-primary)" }}>
          Todos os produtos com pedido de compra em aberto ({pendentes.length})
        </h3>
        {pendentes.length === 0 ? (
          <p className="text-sm px-4 pb-4" style={{ color: "var(--text-muted)" }}>
            Nenhum produto com pedido de compra aberto no momento.
          </p>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--gridline)" }}>
            {pendentes.map((p) => {
              const emRuptura = p.diasDeCobertura !== null && p.diasDeCobertura < RUNWAY_DIAS_ALERTA;
              return (
                <Link
                  key={p.productCode}
                  href={buildHref(p.productCode)}
                  className="flex items-center justify-between gap-3 p-3 flex-wrap hover:opacity-80"
                >
                  <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                    <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                      {p.description ?? "(sem descrição)"}
                    </span>
                    <span className="text-xs flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
                      <span className="font-mono">#{p.productCode}</span>
                      {emRuptura ? (
                        <span className="px-1.5 py-0.5 rounded-full font-bold" style={{ background: "var(--status-critical)", color: "#fff" }}>
                          RUPTURA
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-right shrink-0">
                    <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      Saldo CD: <strong>{p.saldoAtual}un</strong>
                    </span>
                    <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      Disponível: <strong>{p.saldoDisponivel}un</strong>
                    </span>
                    <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      Em pedido: <strong>{p.saldoEmPedidoCompra ?? "—"}un</strong>
                    </span>
                    <span className="text-xs font-semibold" style={{ color: "var(--brand-orange)" }}>
                      {p.previsaoChegada ? formatDateBr(p.previsaoChegada) : "sem previsão"}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
