import { consultarEstoque, type EstoqueProduto } from "@/lib/estoqueLojas";
import { TransferirParaAt } from "@/components/TransferirParaAt";

// Estoque dos produtos por loja/CD (Odoo) -- pedido do Victor 26/10/2026.
// Usada na aba do SAC e no menu da assistência. Ver estoqueLojas.ts.

const qtd = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

function Produto({ p }: { p: EstoqueProduto }) {
  const cd = p.saldos.find((s) => /\bCD\b/.test(s.empresa));
  return (
    <li className="rounded-2xl p-4 sm:p-5 flex flex-col gap-3" style={{ background: "var(--surface-1)" }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            {p.descricao ?? "Produto sem descrição"}
          </p>
          <p className="text-xs tabular-nums" style={{ color: "var(--text-secondary)" }}>
            {p.codigo}
            {p.fabricante ? ` · ${p.fabricante}` : ""}
          </p>
        </div>
        <p className="text-sm tabular-nums" style={{ color: "var(--text-primary)" }}>
          <b className="text-xl">{qtd(p.totalDisponivel)}</b> disponíveis
          <span style={{ color: "var(--text-secondary)" }}> · {qtd(p.total)} no sistema</span>
        </p>
      </div>
      {p.saldos.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Sem estoque em nenhuma loja nem no CD.
        </p>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="text-xs text-left" style={{ color: "var(--text-muted)" }}>
                <th className="px-1 py-1.5 font-medium">Loja / CD</th>
                <th className="px-1 py-1.5 font-medium text-right">Disponível</th>
                <th className="px-1 py-1.5 font-medium text-right">Reservado</th>
                <th className="px-1 py-1.5 font-medium text-right">No sistema</th>
              </tr>
            </thead>
            <tbody>
              {p.saldos.map((s) => {
                const ehCd = /\bCD\b/.test(s.empresa);
                return (
                  <tr key={s.empresaId} className="border-t" style={{ borderColor: "var(--border)" }}>
                    <td className="px-1 py-1.5" style={{ color: "var(--text-primary)", fontWeight: ehCd ? 600 : 400 }}>
                      {s.empresa}
                    </td>
                    <td className="px-1 py-1.5 text-right font-semibold" style={{ color: s.disponivel > 0 ? "var(--text-primary)" : "var(--text-muted)" }}>
                      {qtd(s.disponivel)}
                    </td>
                    <td className="px-1 py-1.5 text-right" style={{ color: "var(--text-secondary)" }}>
                      {s.reservado ? qtd(s.reservado) : "—"}
                    </td>
                    <td className="px-1 py-1.5 text-right" style={{ color: "var(--text-secondary)" }}>
                      {qtd(s.sistema)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {cd && cd.disponivel >= 1 ? (
        <TransferirParaAt codigo={p.codigo} produto={p.descricao} fabricante={p.fabricante} disponivelCd={cd.disponivel} />
      ) : null}
    </li>
  );
}

export async function ConsultaEstoqueView({ busca, acao }: { busca: string; acao: string }) {
  const r = busca ? await consultarEstoque(busca) : null;
  return (
    <div className="flex flex-col gap-6 min-w-0">
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        Estoque de cada produto nas lojas e no CD, direto do Odoo. Disponível = no sistema menos o que já está reservado para vendas.
      </p>
      <form action={acao} method="GET" className="flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={busca}
          placeholder="Nome do produto (ex.: guarda roupa lugano) ou código (ex.: L003206)"
          autoFocus
          className="flex-1 min-w-[240px] rounded-xl px-4 py-2.5 text-sm"
          style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
        />
        <button type="submit" className="rounded-xl px-5 py-2.5 text-sm font-semibold" style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}>
          Buscar
        </button>
      </form>

      {!r ? null : busca.trim().length < 3 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Digite pelo menos 3 letras do nome ou o código do produto.
        </p>
      ) : r.produtos.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Nenhum produto encontrado para “{r.busca}”. Produto cadastrado no Odoo depois de 24/10 só aparece pelo código exato.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {r.falhas.length > 0 ? (
            <p className="text-xs rounded-lg px-3 py-2" style={{ background: "color-mix(in srgb, var(--status-warning) 14%, transparent)", color: "var(--text-primary)" }}>
              Sem leitura do Odoo agora em: {r.falhas.map((f) => f.empresa).join(", ")}. Essas lojas ficaram de fora da conta — tente de novo em instantes.
            </p>
          ) : null}
          {r.limitado ? (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Muitos produtos com esse nome: mostrando os 6 primeiros. Detalhe mais a busca ou use o código.
            </p>
          ) : null}
          <ul className="flex flex-col gap-3">
            {r.produtos.map((p) => (
              <Produto key={p.codigo} p={p} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
