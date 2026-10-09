import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { requireDashboardAuth } from "@/lib/dashboardSession";
import { AppHeader } from "@/components/AppHeader";
import { KpisSectionTabs } from "@/components/KpisSectionTabs";
import { ThHint } from "@/components/logistica/ThHint";
import { LogisticaTerminal } from "@/components/logistica/LogisticaTerminal";
import { IndiceTicker, type TickerItem } from "@/components/logistica/IndiceTicker";
import { parsePeriodoKpis, TIPOS_CARGA, TIPOS_VEICULO } from "@/lib/logisticaApi";
import { getKpisLogistica, resumirLogistica, volumesPorDia, periodoAnterior, calcularVariacao, type Variacao } from "@/lib/kpisLogistica";
import { num, pct, dataBr, VISITAS_MINIMAS } from "@/lib/logisticaFormat";

export const dynamic = "force-dynamic";

// "Hoje"/"Ontem" -- pedido do Victor 09/10/2026 ("dinamismo de consulta
// retroativa... Hoje, Ontem"): janela de 1 dia só, achado pelo mesmo
// mecanismo de menosDias abaixo (n=0 pra hoje, aplicado nos dois limites
// pra virar 1 dia só em vez de intervalo).
const PRESETS = [
  { key: "hoje", label: "Hoje", dias: 1 },
  { key: "ontem", label: "Ontem", dias: 1, offsetDias: 1 },
  { key: "7", label: "7 dias", dias: 7 },
  { key: "30", label: "30 dias", dias: 30 },
  { key: "mes", label: "Este mês", dias: null },
  { key: "90", label: "90 dias", dias: 90 },
] as const;

function hojeRecife(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Recife" }).format(new Date());
}

function menosDias(dia: string, n: number): string {
  const d = new Date(`${dia}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

type Params = { periodo?: string; de?: string; ate?: string; tipo?: string; veiculo?: string };

function resolverPeriodo(params: Params) {
  const hoje = hojeRecife();
  const tipo = params.tipo && (TIPOS_CARGA as readonly string[]).includes(params.tipo) ? params.tipo : undefined;
  const veiculo = params.veiculo && (TIPOS_VEICULO as readonly string[]).includes(params.veiculo) ? params.veiculo : undefined;
  if (params.de || params.ate) {
    return { preset: "custom", de: params.de ?? "", ate: params.ate ?? hoje, tipo, veiculo };
  }
  const preset = PRESETS.find((p) => p.key === params.periodo) ?? PRESETS.find((p) => p.key === "30")!;
  const offsetDias = "offsetDias" in preset ? preset.offsetDias : 0;
  const ate = offsetDias > 0 ? menosDias(hoje, offsetDias) : hoje;
  const de = preset.dias === null ? `${hoje.slice(0, 8)}01` : menosDias(ate, preset.dias - 1);
  return { preset: preset.key, de, ate, tipo, veiculo };
}

function href(base: Record<string, string | undefined>) {
  const q = new URLSearchParams(Object.entries(base).filter((e): e is [string, string] => !!e[1]));
  const s = q.toString();
  return s ? `/kpis/logistica?${s}` : "/kpis/logistica";
}

function pillStyle(active: boolean) {
  return {
    color: active ? "var(--surface-1)" : "var(--text-secondary)",
    background: active ? "var(--brand-green)" : "transparent",
    border: `1px solid ${active ? "var(--brand-green)" : "var(--border)"}`,
  };
}

// Título com ícone "?" (ThHint) quando tem hint -- pedido do Victor
// 09/10/2026, 2ª rodada de refino: "remova todo texto cinza explicativo
// renderizado direto na tela". O antigo "AvisoPosVenda" (parágrafo fixo
// sobre atribuição estimada) virou o hint do título dessa seção, mesmo
// padrão de Secao em LogisticaTerminal.tsx.
function Bloco({ titulo, hint, children }: { titulo: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl p-3 flex flex-col gap-2" style={{ border: "2px solid var(--brand-green)", background: "var(--surface-1)" }}>
      <h2 className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
        {hint ? <ThHint hint={hint}>{titulo}</ThHint> : titulo}
      </h2>
      {children}
    </section>
  );
}

const th = "px-2 py-1.5 font-semibold whitespace-nowrap";
const thStyle = { color: "var(--text-secondary)" };

function TabelaPosVenda({ motoristas }: { motoristas: import("@/lib/kpisLogistica").MotoristaVolta[] }) {
  const linhas = motoristas
    .filter((m) => m.entregasRealizadas > 0 || m.posVenda.total > 0)
    .sort((a, b) => {
      const poucasA = a.entregasRealizadas < VISITAS_MINIMAS;
      const poucasB = b.entregasRealizadas < VISITAS_MINIMAS;
      if (poucasA !== poucasB) return poucasA ? 1 : -1;
      return (b.indiceAssistencia ?? -1) - (a.indiceAssistencia ?? -1) || b.posVenda.total - a.posVenda.total;
    });
  if (linhas.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Nenhuma entrega registrada no período.
      </p>
    );
  }
  return (
    <div className="rounded-lg border overflow-x-auto" style={{ borderColor: "var(--border)" }}>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
            <th className={`${th} text-left`} style={thStyle}>
              Motorista
            </th>
            <th className={`${th} text-right`} style={thStyle}>
              <ThHint hint="Visitas com o produto entregue (completa ou parcial)">Entregas</ThHint>
            </th>
            <th className={`${th} text-right`} style={thStyle}>
              <ThHint hint="Troca e envio de peça, e pedidos da fila de peças">Peças</ThHint>
            </th>
            <th className={`${th} text-right`} style={thStyle}>
              Troca de produto
            </th>
            <th className={`${th} text-right`} style={thStyle}>
              Recolhimento
            </th>
            <th className={`${th} text-right`} style={thStyle}>
              <ThHint hint="Entrega de produto novo decorrente de assistência">Entrega de produto</ThHint>
            </th>
            <th className={`${th} text-right`} style={thStyle}>
              <ThHint hint="Ocorrências ligadas a uma entrega do motorista -- ver explicação no título da seção">≈ Total</ThHint>
            </th>
            <th className={`${th} text-right`} style={thStyle}>
              <ThHint hint="ocorrências de pós-venda ÷ entregas">Índice de Assistência</ThHint>
            </th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((m) => {
            const poucas = m.entregasRealizadas < VISITAS_MINIMAS;
            return (
              <tr key={m.codigo} className="border-b" style={{ borderColor: "var(--border)", opacity: poucas ? 0.55 : 1 }}>
                <td className="px-2 py-1.5">
                  <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
                    {m.nome ?? "Sem nome"}
                  </span>
                  <span className="ml-2 tabular-nums" style={{ color: "var(--text-muted)" }}>
                    {m.codigo}
                    {poucas ? " · poucas entregas" : ""}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{m.entregasRealizadas}</td>
                <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{m.posVenda.pecas}</td>
                <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{m.posVenda.trocaProduto}</td>
                <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{m.posVenda.recolhimento}</td>
                <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{m.posVenda.entregaProduto}</td>
                <td
                  className="px-2 py-1.5 text-right tabular-nums font-semibold"
                  title={`${m.posVenda.porCarga} pela carga do chamado · ${m.posVenda.porNf} pela NF · ${m.posVenda.porCliente} pelo cliente`}
                >
                  {m.posVenda.total}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums font-bold" style={{ color: "var(--text-primary)" }}>
                  {pct(m.indiceAssistencia)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function formatarDeltaPct(d: number): string {
  return `${d >= 0 ? "+" : ""}${(d * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} pp`;
}

function formatarDeltaNum(d: number): string {
  return `${d >= 0 ? "+" : ""}${num(d)}`;
}

// `atual` pode ser null (sem visita/entrega no período) -- calcularVariacao
// exige número, então aqui vira "sem variação" direto, sem forçar 0 (0
// seria uma mentira: não significa "zero", significa "não dá pra medir").
function variar(atual: number | null, anterior: number | null, menorEhMelhor?: boolean): Variacao {
  if (atual === null) return { atual: 0, anterior, delta: null, melhorou: null };
  return calcularVariacao(atual, anterior, menorEhMelhor);
}

// Sub-aba "Logística" de KPIs (08/10/2026, redesenhada 09/10/2026 em 2
// rodadas -- ver PR #584 e o "terminal" em LogisticaTerminal.tsx). Mesmos
// dados do GET /api/logistica/v1/kpis/logistica, lidos direto no servidor
// (RPC kpis_logistica) -- definições em lojas-maia-integracao/apis/
// logistica-v1/kpis-logistica.md.
export default async function KpisLogisticaPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireDashboardAuth();
  const params = await searchParams;
  const sel = resolverPeriodo(params);
  const parsed = parsePeriodoKpis(
    new URLSearchParams({
      de: sel.de,
      ate: sel.ate,
      ...(sel.tipo ? { tipo: sel.tipo } : {}),
      ...(sel.veiculo ? { tipoVeiculo: sel.veiculo } : {}),
    }),
  );
  const base = sel.preset === "custom" ? { de: sel.de, ate: sel.ate } : { periodo: sel.preset };

  // Período anterior (mesma duração, ver periodoAnterior) buscado em
  // paralelo, só pra alimentar o ticker de variação -- pedido do Victor
  // 09/10/2026 ("estilo home broker", comparação com período anterior).
  // Falha nessa busca extra não derruba a página (.catch(() => null)):
  // sem período anterior, o ticker mostra "sem período anterior" em vez
  // de erro.
  const [kpis, kpisAnteriores] = parsed.ok
    ? await Promise.all([
        getKpisLogistica(parsed.periodo),
        getKpisLogistica({ ...periodoAnterior(sel.de, sel.ate), tipo: parsed.periodo.tipo, tipoVeiculo: parsed.periodo.tipoVeiculo }).catch(
          () => null,
        ),
      ])
    : [null, null];
  const resumo = kpis ? resumirLogistica(kpis) : null;
  const resumoAnterior = kpisAnteriores ? resumirLogistica(kpisAnteriores) : null;
  const porDia = kpis ? volumesPorDia(kpis) : [];

  const tickerItems: TickerItem[] = resumo
    ? [
        {
          key: "volta",
          label: "Índice de Volta",
          valor: pct(resumo.indiceVolta),
          variacao: variar(resumo.indiceVolta, resumoAnterior?.indiceVolta ?? null, true),
          formatarDelta: formatarDeltaPct,
        },
        {
          key: "volta-logistica",
          label: "Volta Logística",
          valor: pct(resumo.indiceVoltaLogistica),
          variacao: variar(resumo.indiceVoltaLogistica, resumoAnterior?.indiceVoltaLogistica ?? null, true),
          formatarDelta: formatarDeltaPct,
        },
        {
          key: "assistencia",
          label: "Assistência",
          valor: pct(resumo.indiceAssistencia),
          variacao: variar(resumo.indiceAssistencia, resumoAnterior?.indiceAssistencia ?? null, true),
          formatarDelta: formatarDeltaPct,
        },
        {
          key: "cargas",
          label: "Cargas",
          valor: num(resumo.cargas),
          variacao: variar(resumo.cargas, resumoAnterior?.cargas ?? null),
          formatarDelta: formatarDeltaNum,
        },
        {
          key: "pedidos",
          label: "Pedidos",
          valor: num(resumo.pedidos),
          variacao: variar(resumo.pedidos, resumoAnterior?.pedidos ?? null),
          formatarDelta: formatarDeltaNum,
        },
        {
          key: "volume",
          label: "Volume",
          valor: num(resumo.volumes.total),
          variacao: variar(resumo.volumes.total, resumoAnterior?.volumes.total ?? null),
          formatarDelta: formatarDeltaNum,
        },
      ]
    : [];

  return (
    <div className="max-w-6xl mx-auto px-6 pt-6 pb-10 flex flex-col gap-6">
      <AppHeader />
      <KpisSectionTabs active="logistica" />

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
            Logística
          </h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Cargas despachadas pelo CD, volume por porte e o Índice de Volta de cada motorista. O dia da carga é a previsão definida pelo CD (ZAG_DTPREV).
            A conta de treinamento (000058) fica fora.
          </p>
        </div>
        {/* Página é force-dynamic (sem cache) -- esse horário é o do
            render de verdade, não um placeholder. "Atualizar" é só
            recarregar a mesma URL (mesmo filtro/período já aplicado),
            pedido do Victor pra deixar explícito que os dados são ao
            vivo em telas de TV/reunião. */}
        <Link
          href={href({ ...base, tipo: sel.tipo, veiculo: sel.veiculo })}
          className="flex items-center gap-1.5 text-xs shrink-0 rounded-full px-3 py-1.5"
          style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}
        >
          <RefreshCw aria-hidden size={13} />
          Atualizado às{" "}
          {new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Recife", hour: "2-digit", minute: "2-digit" }).format(new Date())}
        </Link>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <Link key={p.key} href={href({ periodo: p.key, tipo: sel.tipo, veiculo: sel.veiculo })} className="text-sm px-3 py-1 rounded-full" style={pillStyle(sel.preset === p.key)}>
              {p.label}
            </Link>
          ))}
          <form method="get" className="flex items-center gap-1.5 text-sm" style={{ color: "var(--text-secondary)" }}>
            <input
              type="date"
              name="de"
              defaultValue={sel.preset === "custom" ? sel.de : undefined}
              className="rounded px-2 py-1 text-xs"
              style={{ border: "1px solid var(--border)", background: "var(--surface-1)", color: "var(--text-primary)" }}
            />
            <span>até</span>
            <input
              type="date"
              name="ate"
              defaultValue={sel.preset === "custom" ? sel.ate : undefined}
              className="rounded px-2 py-1 text-xs"
              style={{ border: "1px solid var(--border)", background: "var(--surface-1)", color: "var(--text-primary)" }}
            />
            {sel.tipo && <input type="hidden" name="tipo" value={sel.tipo} />}
            {sel.veiculo && <input type="hidden" name="veiculo" value={sel.veiculo} />}
            <button type="submit" className="text-xs px-2 py-1 rounded" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              Aplicar
            </button>
          </form>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          <span>Tipo:</span>
          {[undefined, ...TIPOS_CARGA.filter((t) => t !== "Retirada")].map((t) => (
            <Link key={t ?? "todos"} href={href({ ...base, tipo: t, veiculo: sel.veiculo })} className="text-sm px-3 py-1 rounded-full" style={pillStyle(sel.tipo === t)}>
              {t ?? "Todos"}
            </Link>
          ))}
          <span className="ml-3">Veículo:</span>
          {[undefined, ...TIPOS_VEICULO].map((v) => (
            <Link key={v ?? "todos"} href={href({ ...base, tipo: sel.tipo, veiculo: v })} className="text-sm px-3 py-1 rounded-full" style={pillStyle(sel.veiculo === v)}>
              {v === "Carro" ? "Carro (Strada)" : (v ?? "Todos")}
            </Link>
          ))}
        </div>
      </div>

      {!parsed.ok || !kpis || !resumo ? (
        <p className="text-sm rounded-lg px-4 py-3" style={{ background: "var(--surface-2)", color: "var(--text-primary)" }}>
          {parsed.ok ? "Sem dados." : parsed.erro.mensagem}
        </p>
      ) : (
        <>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {dataBr(kpis.periodo.de)} a {dataBr(kpis.periodo.ate)}
            {kpis.periodo.tipo ? ` · ${kpis.periodo.tipo}` : ""}
            {kpis.periodo.tipoVeiculo ? ` · ${kpis.periodo.tipoVeiculo}` : ""}
          </p>

          <IndiceTicker items={tickerItems} labelComparacao="período anterior" />

          <LogisticaTerminal cargas={kpis.cargas} motoristas={kpis.motoristas} porDia={porDia} causasVolta={resumo.causasVolta} />

          <Bloco
            titulo="Índice de Assistência por motorista"
            hint={`Ocorrências de pós-venda da assistência criadas no período, ligadas ao motorista que fez a entrega original (${num(
              kpis.posVendaPeriodo.vinculadas,
            )} de ${num(kpis.posVendaPeriodo.total)} ocorrências do período acharam a entrega). Atribuição estimada: cada chamado de pós-venda é ligado à entrega que levou o produto, nesta ordem -- carga informada no chamado; entrega da NF de venda quando bate com o mesmo cliente; senão, a entrega mais recente ao mesmo cliente (CPF ou código no Protheus) nos 180 dias anteriores. Uma ocorrência conta uma vez só. Não separa defeito de fábrica de avaria no transporte, por isso fica fora do Índice de Volta.`}
          >
            <TabelaPosVenda motoristas={kpis.motoristas} />
          </Bloco>
        </>
      )}
    </div>
  );
}
