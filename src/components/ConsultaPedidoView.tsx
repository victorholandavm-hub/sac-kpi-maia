import { consultarPedidos, type PedidoConsulta, type TentativaConsulta, type ItemConsulta } from "@/lib/consultaPedido";
import { formatarDocumento } from "@/lib/rotasDoDiaCore";

// Consulta de pedido -- pedido do Victor 26/10/2026 ("onde eu vejo as vendas
// e os status dos pedidos"; no mesmo dia, "onde o sac consulta os
// pedidos?"). Ver consultaPedido.ts.

const dataBr = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Tom = "bom" | "atencao" | "critico" | "neutro";
const COR_TOM: Record<Tom, string> = {
  bom: "var(--status-good)",
  atencao: "var(--status-warning)",
  critico: "var(--status-critical)",
  neutro: "var(--text-muted)",
};

function resultado(t: TentativaConsulta): { rotulo: string; tom: Tom } {
  if (t.comResultado) {
    if (t.resultadoCodigo === "1") return { rotulo: "Entregue", tom: "bom" };
    if (t.resultadoCodigo === "2") return { rotulo: "Entregue em parte", tom: "atencao" };
    if (t.resultadoCodigo === "3") return { rotulo: "Voltou", tom: "critico" };
    if (t.resultadoCodigo === "4") return { rotulo: "Cancelada", tom: "neutro" };
  }
  return { rotulo: t.statusCarga ?? "Sem situação", tom: "neutro" };
}

function tomStatusAtual(s: string | null): Tom {
  if (!s) return "neutro";
  if (/^entregue$/i.test(s)) return "bom";
  if (/n[aã]o entregue|cancel|estorn/i.test(s)) return "critico";
  if (/rota|parcial/i.test(s)) return "atencao";
  return "neutro";
}

function Selo({ texto, tom }: { texto: string; tom: Tom }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap"
      style={{ background: `color-mix(in srgb, ${COR_TOM[tom]} 16%, transparent)`, color: "var(--text-primary)" }}
    >
      <span aria-hidden className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: COR_TOM[tom] }} />
      {texto}
    </span>
  );
}

function Itens({ itens }: { itens: ItemConsulta[] }) {
  if (itens.length === 0) return null;
  return (
    <ul className="text-xs flex flex-col gap-0.5" style={{ color: "var(--text-secondary)" }}>
      {itens.map((i, n) => (
        <li key={`${i.codigo}-${n}`}>
          {i.quantidade.toLocaleString("pt-BR")} × {i.descricao ?? i.codigo}
        </li>
      ))}
    </ul>
  );
}

function Rotulo({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
      {children}
    </span>
  );
}

function Pedido({ p, busca }: { p: PedidoConsulta; busca: string }) {
  const v = p.venda;
  const e = p.entrega;
  const destaque =
    (e && busca.replace(/\D/g, "").padStart(6, "0") === e.pedido) || (v && busca.replace(/\D/g, "").padStart(9, "0") === v.notaFiscal);
  return (
    <li
      className="rounded-2xl p-4 sm:p-5 flex flex-col gap-4"
      style={{ background: "var(--surface-1)", outline: destaque ? "2px solid var(--brand-green)" : undefined }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-base font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
            {e ? `Pedido ${e.pedido}` : `Venda NF ${v?.notaFiscal.replace(/^0+/, "")}`}
          </span>
          <span className="text-xs tabular-nums" style={{ color: "var(--text-secondary)" }}>
            {dataBr(p.data)} · filial {e?.filial ?? v?.filial}
            {e?.loja ? ` · ${e.loja}` : ""}
          </span>
        </div>
        {e ? <Selo texto={e.statusAtual ?? "Sem status"} tom={tomStatusAtual(e.statusAtual)} /> : <Selo texto="Sem entrega" tom="neutro" />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-5">
        <div className="flex flex-col gap-2">
          <Rotulo>Venda</Rotulo>
          {v ? (
            <>
              <p className="text-sm tabular-nums" style={{ color: "var(--text-primary)" }}>
                NF {v.notaFiscal.replace(/^0+/, "")} · {dataBr(v.data)} · <b>{brl(v.valor)}</b>
              </p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {v.vendedor ?? "Vendedor não informado"}
                {v.formaPagamento ? ` · ${v.formaPagamento}` : ""}
              </p>
              <Itens itens={v.itens} />
            </>
          ) : (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Venda não encontrada na base (o cliente comprou antes do sync das vendas, ou em outra filial).
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Rotulo>Entrega</Rotulo>
          {!e ? (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Sem entrega registrada: retirada na loja, ou ainda sem carga.
            </p>
          ) : e.tentativas.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Pedido no Protheus sem carga ainda.
            </p>
          ) : (
            <ol className="flex flex-col gap-2.5">
              {e.tentativas.map((t) => {
                const r = resultado(t);
                return (
                  <li key={`${t.carga}-${t.tentativa}`} className="rounded-xl px-3 py-2.5 flex flex-col gap-1" style={{ background: "var(--surface-2)" }}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm tabular-nums" style={{ color: "var(--text-primary)" }}>
                        Carga #{t.carga}
                        {t.tentativa ? ` · ${t.tentativa}ª tentativa` : ""}
                        <span style={{ color: "var(--text-secondary)" }}> · previsão {dataBr(t.previsao)}</span>
                      </span>
                      <Selo texto={r.rotulo} tom={r.tom} />
                    </div>
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      {[t.tipo, t.motorista ?? "sem motorista", t.veiculo, t.transportadora].filter(Boolean).join(" · ")}
                      {t.baixaDia ? ` · baixa ${dataBr(t.baixaDia)}${t.baixaHora ? ` ${t.baixaHora}` : ""}` : ""}
                    </p>
                    {t.ocorrencia && t.resultadoCodigo !== "1" ? (
                      <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                        Motivo: {t.ocorrencia}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </li>
  );
}

const EXEMPLOS = "CPF/CNPJ, número do pedido, nota da venda ou nome do cliente";

// Tela inteira da consulta (título, busca e resultado) -- usada no painel
// (/pedidos) e no sistema da assistência (SAC e assistência), cada um com o
// próprio login. `acao` = a rota da própria página (o formulário é GET).
// `embutida`: dentro de uma página que já tem título e abas (SAC/assistência)
// -- sem o título e sem a margem da página do painel.
export async function ConsultaPedidoView({ busca, acao, embutida = false }: { busca: string; acao: string; embutida?: boolean }) {
  const r = busca ? await consultarPedidos(busca) : null;

  return (
    <div className={embutida ? "flex flex-col gap-6 min-w-0" : "max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-10 flex flex-col gap-6"}>
      {embutida ? (
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Venda, carga e entrega de cada pedido do cliente, com o status atual no Protheus (atualiza a cada 10 a 30 min).
        </p>
      ) : (
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
            Consulta de pedido
          </h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Venda, carga e entrega de cada pedido do cliente, com o status atual no Protheus.
          </p>
        </div>
      )}

      <form action={acao} method="GET" className="flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={busca}
          placeholder={EXEMPLOS}
          autoFocus
          className="flex-1 min-w-[240px] rounded-xl px-4 py-2.5 text-sm"
          style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
        />
        <button type="submit" className="rounded-xl px-5 py-2.5 text-sm font-semibold" style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}>
          Buscar
        </button>
      </form>

      {!r ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Busque por {EXEMPLOS}.
        </p>
      ) : r.tipo === "curta" ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Digite pelo menos 3 letras do nome, ou o número completo.
        </p>
      ) : r.clientes.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Nada encontrado para “{r.busca}”.
        </p>
      ) : (
        <div className="flex flex-col gap-8">
          {r.limitado ? (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Muitos clientes com esse nome: mostrando os 10 mais recentes. Busque pelo CPF pra achar um só.
            </p>
          ) : null}
          {r.clientes.map((c) => (
            <section key={c.codigo} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                  {c.nome ?? "Cliente sem nome"}
                </h2>
                <span className="text-xs tabular-nums" style={{ color: "var(--text-secondary)" }}>
                  {formatarDocumento(c.documento) ?? "sem documento"} · código {c.codigo} · {c.pedidos.length} pedido{c.pedidos.length === 1 ? "" : "s"}
                </span>
              </div>
              <ul className="flex flex-col gap-3">
                {c.pedidos.map((p) => (
                  <Pedido key={`${p.entrega?.pedido ?? ""}-${p.entrega?.filial ?? ""}-${p.venda?.id ?? ""}`} p={p} busca={r.busca} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
