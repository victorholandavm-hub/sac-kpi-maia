import Link from "next/link";
import { requireDashboardAuth } from "@/lib/dashboardSession";
import { AppHeader } from "@/components/AppHeader";
import { KpisSectionTabs } from "@/components/KpisSectionTabs";
import { KpiCardShell } from "@/components/KpiCardShell";
import { VolumePorteChart } from "@/components/logistica/VolumePorteChart";
import { parsePeriodoKpis, TIPOS_CARGA } from "@/lib/logisticaApi";
import { getKpisLogistica, resumirLogistica, volumesPorDia, type MotoristaVolta } from "@/lib/kpisLogistica";

export const dynamic = "force-dynamic";

// Motorista com menos visitas que isso tem índice instável (1 volta em 5
// visitas = 20%) -- aparece na tabela, mas apagado.
const VISITAS_MINIMAS = 20;

const PRESETS = [
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

type Params = { periodo?: string; de?: string; ate?: string; tipo?: string };

function resolverPeriodo(params: Params) {
  const hoje = hojeRecife();
  const tipo = params.tipo && (TIPOS_CARGA as readonly string[]).includes(params.tipo) ? params.tipo : undefined;
  if (params.de || params.ate) {
    return { preset: "custom", de: params.de ?? "", ate: params.ate ?? hoje, tipo };
  }
  const preset = PRESETS.find((p) => p.key === params.periodo) ?? PRESETS[1];
  const de = preset.dias === null ? `${hoje.slice(0, 8)}01` : menosDias(hoje, preset.dias - 1);
  return { preset: preset.key, de, ate: hoje, tipo };
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

const num = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const pct = (v: number | null, casas = 1) =>
  v === null ? "—" : `${(v * 100).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
const dataBr = (dia: string) => dia.split("-").reverse().join("/");

function CardTitulo({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
      {children}
    </span>
  );
}

function CardValor({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-4xl font-bold leading-none tabular-nums" style={{ color: "var(--text-primary)" }}>
      {children}
    </span>
  );
}

function CardNota({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
      {children}
    </span>
  );
}

function Bloco({ titulo, subtitulo, children }: { titulo: string; subtitulo?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl p-5 flex flex-col gap-4" style={{ border: "2px solid var(--brand-green)", background: "var(--surface-1)" }}>
      <div>
        <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
          {titulo}
        </h2>
        {subtitulo && (
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {subtitulo}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

function AvisoAtribuicao() {
  return (
    <div
      className="flex items-start gap-3 rounded-lg px-4 py-3"
      style={{ background: "var(--brand-orange-soft)", border: "1px solid var(--brand-orange)" }}
      role="note"
    >
      <span aria-hidden className="text-lg leading-none" style={{ color: "var(--brand-orange)" }}>
        ⚠
      </span>
      <div className="text-sm" style={{ color: "var(--text-primary)" }}>
        <p className="font-bold">Atribuição Estimada (vínculo por CPF)</p>
        <p style={{ color: "var(--text-secondary)" }}>
          Devoluções e assistências não dizem qual entrega originou o retorno. Elas são ligadas ao motorista da entrega mais recente ao mesmo CPF nos
          30 dias anteriores, ou pela carga informada no chamado quando existe. Um cliente com duas entregas no mês cai na mais recente. As colunas
          marcadas com <strong>≈</strong> usam essa estimativa; insucessos e parciais vêm direto da carga.
        </p>
      </div>
    </div>
  );
}

const th = "px-3 py-2 font-semibold whitespace-nowrap";
const thStyle = { color: "var(--text-secondary)" };

function TabelaMotoristas({ motoristas }: { motoristas: MotoristaVolta[] }) {
  if (motoristas.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Nenhuma visita registrada no período.
      </p>
    );
  }
  return (
    <div className="rounded-lg border overflow-x-auto" style={{ borderColor: "var(--border)" }}>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
            <th className={`${th} text-left`} style={thStyle}>
              Motorista
            </th>
            <th className={`${th} text-right`} style={thStyle}>
              Cargas
            </th>
            <th className={`${th} text-right`} style={thStyle}>
              Visitas
            </th>
            <th className={`${th} text-right`} style={thStyle} title="Cliente / logística / CD (L06, pedido não carregado) / outros">
              Insucessos
            </th>
            <th className={`${th} text-right`} style={thStyle}>
              Parciais
            </th>
            <th className={`${th} text-right`} style={thStyle} title="Estimado pelo CPF (ver aviso acima)">
              ≈ Devoluções
            </th>
            <th className={`${th} text-right`} style={thStyle} title="Pela carga do chamado ou estimado pelo CPF (ver aviso acima)">
              ≈ Assistências
            </th>
            <th className={`${th} text-right`} style={thStyle} title="(insucessos + parciais + devoluções + assistências) ÷ visitas">
              Volta total
            </th>
            <th
              className={`${th} text-right`}
              style={thStyle}
              title="(insucessos de logística, exceto L06 + assistências por erro do motorista ou avaria no transporte) ÷ visitas"
            >
              Volta logística
            </th>
          </tr>
        </thead>
        <tbody>
          {motoristas.map((m) => {
            const poucas = m.visitas < VISITAS_MINIMAS;
            return (
              <tr key={m.codigo} className="border-b" style={{ borderColor: "var(--border)", opacity: poucas ? 0.55 : 1 }}>
                <td className="px-3 py-2.5">
                  <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
                    {m.nome ?? "Sem nome"}
                  </span>
                  <span className="ml-2 text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>
                    {m.codigo}
                    {poucas ? " · poucas visitas" : ""}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{m.cargas}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{m.visitas}</td>
                <td className="px-3 py-2.5 text-right tabular-nums" title={`Cliente ${m.insucessos.cliente} · logística ${m.insucessos.logistica} · CD ${m.insucessos.cd} · outros ${m.insucessos.outros}`}>
                  {m.insucessos.total}
                  {m.insucessos.cd > 0 && (
                    <span className="ml-1 text-xs" style={{ color: "var(--text-muted)" }}>
                      ({m.insucessos.cd} CD)
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{m.parciais}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{m.devolucoes}</td>
                <td className="px-3 py-2.5 text-right tabular-nums" title={`${m.assistencias.porCarga} pela carga do chamado · ${m.assistencias.porCpf} pelo CPF`}>
                  {m.assistencias.total}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums font-semibold" style={{ color: "var(--text-primary)" }}>
                  {pct(m.indiceVolta)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums font-semibold" style={{ color: "var(--text-primary)" }}>
                  {pct(m.indiceVoltaLogistica)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Sub-aba "Logística" de KPIs (08/10/2026). Mesmos dados do
// GET /api/logistica/v1/kpis/logistica, lidos direto no servidor (RPC
// kpis_logistica) -- definições em lojas-maia-integracao/apis/logistica-v1/
// kpis-logistica.md.
export default async function KpisLogisticaPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireDashboardAuth();
  const params = await searchParams;
  const sel = resolverPeriodo(params);
  const parsed = parsePeriodoKpis(new URLSearchParams({ de: sel.de, ate: sel.ate, ...(sel.tipo ? { tipo: sel.tipo } : {}) }));
  const base = sel.preset === "custom" ? { de: sel.de, ate: sel.ate } : { periodo: sel.preset };

  const kpis = parsed.ok ? await getKpisLogistica(parsed.periodo) : null;
  const resumo = kpis ? resumirLogistica(kpis) : null;
  const porDia = kpis ? volumesPorDia(kpis) : [];
  const volumeClassificado = resumo ? resumo.volumes.total - resumo.volumes.naoClassificado : 0;

  return (
    <div className="max-w-6xl mx-auto px-6 pt-6 pb-10 flex flex-col gap-6">
      <AppHeader />
      <KpisSectionTabs active="logistica" />

      <div>
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
          Logística
        </h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Cargas despachadas pelo CD, volume por porte e o Índice de Volta de cada motorista. O dia da carga é a previsão definida pelo CD (ZAG_DTPREV).
          A conta de treinamento (000058) fica fora.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <Link key={p.key} href={href({ periodo: p.key, tipo: sel.tipo })} className="text-sm px-3 py-1 rounded-full" style={pillStyle(sel.preset === p.key)}>
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
            <button type="submit" className="text-xs px-2 py-1 rounded" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              Aplicar
            </button>
          </form>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          <span>Tipo:</span>
          {[undefined, ...TIPOS_CARGA.filter((t) => t !== "Retirada")].map((t) => (
            <Link key={t ?? "todos"} href={href({ ...base, tipo: t })} className="text-sm px-3 py-1 rounded-full" style={pillStyle(sel.tipo === t)}>
              {t ?? "Todos"}
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
          </p>

          <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <KpiCardShell>
              <CardTitulo>Cargas despachadas</CardTitulo>
              <CardValor>{num(resumo.cargas)}</CardValor>
              <CardNota>
                {resumo.dias > 0 ? `${(resumo.cargas / resumo.dias).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} por dia com carga` : "—"}
              </CardNota>
            </KpiCardShell>
            <KpiCardShell>
              <CardTitulo>Pedidos nas cargas</CardTitulo>
              <CardValor>{num(resumo.pedidos)}</CardValor>
              <CardNota>
                {pct(resumo.visitas > 0 ? resumo.entregues / resumo.visitas : null)} das visitas entregues por completo
              </CardNota>
            </KpiCardShell>
            <KpiCardShell>
              <CardTitulo>Volume despachado</CardTitulo>
              <CardValor>{num(resumo.volumes.total)}</CardValor>
              <CardNota>
                unidades · G {pct(volumeClassificado ? resumo.volumes.G / volumeClassificado : null, 0)} · M{" "}
                {pct(volumeClassificado ? resumo.volumes.M / volumeClassificado : null, 0)} · P{" "}
                {pct(volumeClassificado ? resumo.volumes.P / volumeClassificado : null, 0)}
              </CardNota>
            </KpiCardShell>
            <KpiCardShell>
              <CardTitulo>Índice de Volta</CardTitulo>
              <CardValor>{pct(resumo.indiceVolta)}</CardValor>
              <CardNota>retrabalho total por visita (≈ inclui estimativa por CPF)</CardNota>
            </KpiCardShell>
            <KpiCardShell>
              <CardTitulo>Volta Logística</CardTitulo>
              <CardValor>{pct(resumo.indiceVoltaLogistica)}</CardValor>
              <CardNota>
                só o que é do transporte
                {resumo.insucessosCd > 0 ? ` · ${resumo.insucessosCd} falha${resumo.insucessosCd === 1 ? "" : "s"} do CD (L06) à parte` : ""}
              </CardNota>
            </KpiCardShell>
          </section>

          <Bloco
            titulo="Volume por porte (P/M/G)"
            subtitulo={`Unidades despachadas por dia. Porte pela descrição do produto; ${num(resumo.volumes.naoClassificado)} unidade(s) sem classe no período.`}
          >
            <VolumePorteChart data={porDia} />
            <details>
              <summary className="cursor-pointer text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Ver as {resumo.cargas} cargas
              </summary>
              <div className="mt-3 rounded-lg border overflow-x-auto" style={{ borderColor: "var(--border)" }}>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                      {["Dia", "Carga", "Tipo", "Motorista", "Pedidos", "P", "M", "G", "Sem classe"].map((h, i) => (
                        <th key={h} className={`${th} ${i >= 4 ? "text-right" : "text-left"}`} style={thStyle}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {kpis.cargas.map((c) => (
                      <tr key={c.carga} className="border-b" style={{ borderColor: "var(--border)" }}>
                        <td className="px-3 py-2 tabular-nums">{dataBr(c.dia)}</td>
                        <td className="px-3 py-2 tabular-nums font-medium" style={{ color: "var(--text-primary)" }}>
                          {c.carga}
                        </td>
                        <td className="px-3 py-2">{c.tipo ?? "—"}</td>
                        <td className="px-3 py-2">{c.motorista?.nome ?? c.motorista?.codigo ?? "Sem motorista"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{c.pedidos}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{num(c.volumes.P)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{num(c.volumes.M)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{num(c.volumes.G)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{num(c.volumes.naoClassificado)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </Bloco>

          <Bloco
            titulo="Índice de Volta por motorista"
            subtitulo={`Denominador: visitas (cada passagem de um pedido numa carga com resultado). Motoristas com menos de ${VISITAS_MINIMAS} visitas aparecem apagados.`}
          >
            <AvisoAtribuicao />
            <TabelaMotoristas motoristas={kpis.motoristas} />
          </Bloco>
        </>
      )}
    </div>
  );
}
