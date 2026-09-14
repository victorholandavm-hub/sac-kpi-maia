import type { VendaVsAssistenciaStat } from "@/lib/kpiAssistencia";
import { VendaVsAssistenciaDrilldown } from "./VendaVsAssistenciaDrilldown";

// "Vendas x Assistência técnica" por loja -- pedido do Victor 14/09/2026:
// "quero ver o percentual de quantidade de vendas (entregas) x quantidade
// de assistencia tecnica". Cruza duas fontes independentes pro MESMO
// período, sem vínculo pedido a pedido -- confirmado com o Victor via 3
// perguntas: (1) vendas = pedidos type='Venda' do Protheus, (2)
// assistência técnica = TODOS os tipos do sistema integrado (não só
// Entregas, escopo mais largo que o resto desta página), (3) por loja.
//
// Redesenhada 14/09/2026 (mesmo pedido, revisão de UI/UX): zebra stripe,
// alinhamento numérico à direita, faixa de cor no percentual (crítico/
// atenção/normal) e linha de Total Geral no rodapé. Cores reaproveitam os
// tokens semânticos já usados no resto do app (--status-critical/warning,
// ver globals.css) -- não cores soltas.

const CRITICO_PCT = 15;
const ATENCAO_PCT = 8;

function formatInt(value: number): string {
  return value.toLocaleString("pt-BR");
}

// Largura fixa pro badge/texto da célula de percentual -- pedido do
// Victor 14/09/2026 ("retoque de UI"): sem isso, "4,4%" (3 dígitos) e
// "21,3%" (4 dígitos) tinham badges de tamanho diferente (inline-block
// abraça o conteúdo), quebrando o alinhamento vertical entre linhas.
// `text-center` centraliza o conteúdo dentro dessa largura -- é o que
// também resolve o hífen (sem venda) ficando "colado" na borda direita
// da célula: com largura fixa + centralizado, ele fica no meio do
// próprio badge, não da coluna inteira.
const PERCENT_BADGE_CLASS = "inline-block w-20 text-center";

function PercentualCell({ percentual }: { percentual: number | null }) {
  if (percentual == null) {
    // Sem venda no período -- "0,0%" seria enganoso (não é que a taxa é
    // zero, é que não dá pra calcular uma taxa sem denominador). Hífen
    // simples, mesmo alinhamento numérico das outras linhas, sem badge
    // (não é "baixa taxa", é "não aplicável") -- pedido do Victor: "não
    // quebrar o padrão numérico" mas continuar deixando claro que é
    // diferente de uma taxa de fato calculada.
    return (
      <span className={PERCENT_BADGE_CLASS} style={{ color: "var(--text-muted)" }} title="Sem venda sincronizada no período -- não dá pra calcular percentual.">
        —
      </span>
    );
  }

  // Só as faixas que pedem atenção (atenção/crítico) ganham badge --
  // baixa fica em texto simples, cinza/neutro (pedido do Victor: "verde/
  // cinza para baixas"). Um badge em toda linha "normal" diluiria o que
  // realmente precisa chamar atenção.
  if (percentual > CRITICO_PCT) {
    return (
      <span
        className={`${PERCENT_BADGE_CLASS} rounded px-1.5 py-0.5 font-semibold`}
        style={{ color: "var(--status-critical)", background: "color-mix(in srgb, var(--status-critical) 14%, transparent)" }}
      >
        {percentual.toFixed(1).replace(".", ",")}%
      </span>
    );
  }
  if (percentual >= ATENCAO_PCT) {
    return (
      <span
        className={`${PERCENT_BADGE_CLASS} rounded px-1.5 py-0.5 font-semibold`}
        style={{ color: "var(--status-warning)", background: "color-mix(in srgb, var(--status-warning) 16%, transparent)" }}
      >
        {percentual.toFixed(1).replace(".", ",")}%
      </span>
    );
  }
  return (
    <span className={PERCENT_BADGE_CLASS} style={{ color: "var(--text-secondary)" }}>
      {percentual.toFixed(1).replace(".", ",")}%
    </span>
  );
}

export function VendaVsAssistenciaTable({ data }: { data: VendaVsAssistenciaStat[] }) {
  const totalVendas = data.reduce((soma, r) => soma + r.vendas, 0);
  const totalChamados = data.reduce((soma, r) => soma + r.chamados, 0);
  const totalPercentual = totalVendas > 0 ? (totalChamados / totalVendas) * 100 : null;

  return (
    <div className="rounded-lg border p-4" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
        <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          Vendas x Assistência técnica por loja
        </h3>
        <div className="flex items-center gap-3 text-[11px]" style={{ color: "var(--text-muted)" }}>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: "var(--status-critical)" }} /> {`> ${CRITICO_PCT}%`}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: "var(--status-warning)" }} /> {`${ATENCAO_PCT}–${CRITICO_PCT}%`}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: "var(--text-muted)" }} /> {`< ${ATENCAO_PCT}%`}
          </span>
        </div>
      </div>
      <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
        Vendas = pedidos de venda do Protheus no período. Assistência técnica = todos os chamados do sistema integrado no
        mesmo período (entrega, troca, peça, montagem, desmontagem, vistoria etc.) — duas fontes diferentes, sem vínculo
        pedido a pedido.
      </p>
      {data.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Sem dados suficientes ainda.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
            <thead>
              <tr style={{ color: "var(--text-muted)" }}>
                <th className="py-1.5 pr-4 font-normal text-left">Loja</th>
                <th className="py-1.5 pr-4 font-normal text-right">Vendas (Protheus)</th>
                <th className="py-1.5 pr-4 font-normal text-right">Assistência técnica</th>
                <th className="py-1.5 pr-2 font-normal text-right">% assistência / venda</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={row.storeId} style={{ background: i % 2 === 1 ? "var(--surface-2)" : undefined }}>
                  <td className="py-2.5 pr-4 text-left" style={{ color: "var(--text-primary)" }}>
                    {row.storeName}
                  </td>
                  <td className="py-2.5 pr-4 text-right">{formatInt(row.vendas)}</td>
                  <td className="py-2.5 pr-4 text-right">{formatInt(row.chamados)}</td>
                  <td className="py-2.5 pr-2 text-right">
                    {/* Clicar no percentual abre a lista de chamados por
                        trás dele, agrupada por tipo -- pedido do Victor
                        14/09/2026 ("quando eu clicar no percentual...").
                        Sem chamado no período (tickets vazio), o wrapper
                        deixa de virar botão sozinho -- ver
                        VendaVsAssistenciaDrilldown.tsx. */}
                    <VendaVsAssistenciaDrilldown storeName={row.storeName} tickets={row.tickets}>
                      <PercentualCell percentual={row.percentual} />
                    </VendaVsAssistenciaDrilldown>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {/* Total Geral -- pedido do Victor 14/09/2026: soma bruta de
                  vendas e chamados, com o percentual GLOBAL recalculado em
                  cima da soma (não a média dos percentuais de cada linha --
                  isso sub/superestimaria o total puxado por lojas pequenas
                  com poucas vendas, mesma armadilha de médias de percentual
                  em geral). */}
              <tr className="font-semibold border-t-2" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                <td className="py-2.5 pr-4 text-left">Total geral</td>
                <td className="py-2.5 pr-4 text-right">{formatInt(totalVendas)}</td>
                <td className="py-2.5 pr-4 text-right">{formatInt(totalChamados)}</td>
                <td className="py-2.5 pr-2 text-right">
                  <PercentualCell percentual={totalPercentual} />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
