import { requireDashboardAuth } from "@/lib/dashboardSession";
import { PainelLogistica } from "@/components/logistica/PainelLogistica";
import { parsePeriodoKpis, TIPOS_CARGA, TIPOS_VEICULO } from "@/lib/logisticaApi";
import { getKpisEntregas, getQualidadeDados, periodoAnterior, VINCULOS } from "@/lib/kpisLogistica";
import { getLastSuccessfulRunAt } from "@/lib/syncRuns";
import { getRotasDoDia } from "@/lib/rotasDoDia";

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

function maisRecente(a: string | null, b: string | null): string | null {
  if (!a || !b) return a ?? b;
  return Date.parse(a) > Date.parse(b) ? a : b;
}

type Params = { periodo?: string; de?: string; ate?: string; tipo?: string; veiculo?: string; vinculo?: string };

function resolverPeriodo(params: Params) {
  const hoje = hojeRecife();
  const tipo = params.tipo && (TIPOS_CARGA as readonly string[]).includes(params.tipo) ? params.tipo : undefined;
  const veiculo = params.veiculo && (TIPOS_VEICULO as readonly string[]).includes(params.veiculo) ? params.veiculo : undefined;
  const vinculo = params.vinculo && (VINCULOS as readonly string[]).includes(params.vinculo) ? params.vinculo : undefined;
  if (params.de || params.ate) {
    return { preset: "custom", de: params.de ?? "", ate: params.ate ?? hoje, tipo, veiculo, vinculo };
  }
  const preset = PRESETS.find((p) => p.key === params.periodo) ?? PRESETS.find((p) => p.key === "30")!;
  const offsetDias = "offsetDias" in preset ? preset.offsetDias : 0;
  const ate = offsetDias > 0 ? menosDias(hoje, offsetDias) : hoje;
  const de = preset.dias === null ? `${hoje.slice(0, 8)}01` : menosDias(ate, preset.dias - 1);
  return { preset: preset.key, de, ate, tipo, veiculo, vinculo };
}

// Sub-aba "Logística" de KPIs (08/10/2026, redesenhada 09/10/2026 em 2
// rodadas -- ver PR #584 e o "terminal" em LogisticaTerminal.tsx). Lê a RPC
// kpis_entregas (migração 0169), NÃO a mesma RPC do GET
// /api/logistica/v1/kpis/logistica (kpis_logistica) -- são duas funções
// diferentes desde que a tela ficou restrita a só entregas (13/10/2026, ver
// comentário abaixo). indiceVolta/indiceVoltaLogistica foram realinhados
// entre as duas na revisão de 15/10/2026 (migração 0172), mas o resto do
// formato (posVenda/pecas agregado aqui vs. motivosInsucesso/produtosPorte
// só na API) continua diferente -- definições em lojas-maia-integracao/apis/
// logistica-v1/kpis-logistica.md.
export default async function KpisLogisticaPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireDashboardAuth();
  const params = await searchParams;
  const sel = resolverPeriodo(params);
  const vinculo = sel.vinculo ?? null;
  const parsed = parsePeriodoKpis(
    new URLSearchParams({
      de: sel.de,
      ate: sel.ate,
      ...(sel.tipo ? { tipo: sel.tipo } : {}),
      ...(sel.veiculo ? { tipoVeiculo: sel.veiculo } : {}),
    }),
  );

  // Tela só de entregas (RPC kpis_entregas, migração 0162) -- pedido do
  // Victor 13/10/2026: Índice de Volta só com a entrega; as assistências
  // vêm à parte por motorista (migração 0163).
  // Período anterior (mesma duração, ver periodoAnterior) buscado em
  // paralelo, só pra alimentar o ticker de variação -- pedido do Victor
  // 09/10/2026 ("estilo home broker", comparação com período anterior).
  // Falha nessa busca extra não derruba a página (.catch(() => null)):
  // sem período anterior, o ticker mostra "sem período anterior" em vez
  // de erro.
  const ultimoSyncPromise = Promise.all([
    getLastSuccessfulRunAt("totvs").catch(() => null),
    getLastSuccessfulRunAt("totvs-cargas").catch(() => null),
    // Desde a virada (25/10/2026) as cargas vêm do Odoo.
    getLastSuccessfulRunAt("odoo-cargas").catch(() => null),
  ]).then(([completo, cargas, odoo]) => maisRecente(maisRecente(completo, cargas), odoo));
  // Dia sem carga (domingo): o mural mostra o último dia de operação. Carga
  // de dia anterior ainda em rota não conta como carga do dia.
  const rotasPromise = getRotasDoDia(hojeRecife())
    .then(async (r) =>
      r.cargas.every((c) => c.dia < r.dia) && r.ultimoDiaComCargas
        ? { rotas: await getRotasDoDia(r.ultimoDiaComCargas), historico: true }
        : { rotas: r, historico: false },
    )
    .catch(() => null);
  // Falha (ex.: timeout do banco, 17/10/2026) não derruba a página: o mural
  // Rotas de hoje continua e os indicadores mostram o aviso.
  let falhaKpis = false;
  const qualidadePromise = parsed.ok ? getQualidadeDados(parsed.periodo.de, parsed.periodo.ate).catch(() => null) : Promise.resolve(null);
  const [kpis, kpisAnteriores] = parsed.ok
    ? await Promise.all([
        getKpisEntregas({ ...parsed.periodo, vinculo }).catch((err) => {
          console.error("[kpis/logistica]", (err as Error).message);
          falhaKpis = true;
          return null;
        }),
        getKpisEntregas({ ...periodoAnterior(sel.de, sel.ate), tipo: parsed.periodo.tipo, tipoVeiculo: parsed.periodo.tipoVeiculo, vinculo }).catch(
          () => null,
        ),
      ])
    : [null, null];
  const [ultimoSync, rotas] = await Promise.all([ultimoSyncPromise, rotasPromise]);
  return (
    <PainelLogistica
      sel={sel}
      presets={PRESETS.map((p) => ({ valor: p.key, rotulo: p.label }))}
      erro={
        !parsed.ok
          ? parsed.erro.mensagem
          : falhaKpis
            ? "Os indicadores do período não carregaram agora (o banco demorou demais). Clique em atualizar ou tente de novo em instantes."
            : null
      }
      kpis={kpis}
      kpisAnteriores={kpisAnteriores}
      qualidade={await qualidadePromise}
      rotas={rotas?.rotas ?? null}
      rotasHistorico={rotas?.historico ?? false}
      ultimoSync={ultimoSync}
    />
  );
}
