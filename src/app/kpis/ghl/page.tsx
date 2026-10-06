import { AppHeader } from "@/components/AppHeader";
import { KpisSectionTabs } from "@/components/KpisSectionTabs";
import { UnderlineTab } from "@/components/UnderlineTab";
import { SUBCONTAS, resumoAtendimentos, type SubcontaKey } from "@/lib/ghlSubcontas";

export const revalidate = 60;

const SUB_KEYS = Object.keys(SUBCONTAS) as SubcontaKey[];

function formatMinutos(value: number | null): string {
  if (value === null) return "—";
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} min`;
}

export default async function KpisGhlPage({ searchParams }: { searchParams: Promise<{ sub?: string }> }) {
  const { sub } = await searchParams;
  const key: SubcontaKey = sub === "lider" ? "lider" : "lojas_maia";
  const { porAtendente, atualizadoEm } = await resumoAtendimentos(key);

  const totalConversas = porAtendente.reduce((sum, a) => sum + a.conversas, 0);
  const totalRespondidas = porAtendente.reduce((sum, a) => sum + a.respondidas, 0);

  return (
    <>
      <div className="max-w-6xl mx-auto px-6 pt-6 flex flex-col gap-4">
        <AppHeader />
        <KpisSectionTabs active="ghl" />
        <div className="flex items-center gap-2 border-b" style={{ borderColor: "var(--border)" }}>
          {SUB_KEYS.map((k) => (
            <UnderlineTab key={k} href={`/kpis/ghl?sub=${k === "lider" ? "lider" : "lojas_maia"}`} label={SUBCONTAS[k].label} active={k === key} color="var(--brand-orange)" />
          ))}
        </div>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Conversas atribuídas aos atendentes do SAC nos últimos 60 dias. Tempo medido até a primeira resposta do próprio atendente, em horário comercial.
          {atualizadoEm ? ` Última atualização: ${new Date(atualizadoEm).toLocaleString("pt-BR", { timeZone: "America/Fortaleza" })}.` : " Ainda sem dados sincronizados."}
        </p>
        <div className="rounded-xl border overflow-x-auto" style={{ borderColor: "var(--border)" }}>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                <th className="text-left px-3 py-2 font-semibold" style={{ color: "var(--text-secondary)" }}>
                  Atendente
                </th>
                <th className="text-right px-3 py-2 font-semibold" style={{ color: "var(--text-secondary)" }}>
                  Conversas
                </th>
                <th className="text-right px-3 py-2 font-semibold" style={{ color: "var(--text-secondary)" }}>
                  Com resposta
                </th>
                <th className="text-right px-3 py-2 font-semibold" style={{ color: "var(--text-secondary)" }}>
                  Tempo médio 1ª resposta
                </th>
              </tr>
            </thead>
            <tbody>
              {porAtendente.map((a) => (
                <tr key={a.nome} className="border-b" style={{ borderColor: "var(--border)" }}>
                  <td className="px-3 py-2.5 font-medium" style={{ color: "var(--text-primary)" }}>
                    {a.nome}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{a.conversas}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{a.respondidas}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatMinutos(a.tempoMedioMin)}</td>
                </tr>
              ))}
              <tr style={{ background: "var(--surface-2)" }}>
                <td className="px-3 py-2.5 font-semibold" style={{ color: "var(--text-primary)" }}>
                  Total
                </td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{totalConversas}</td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{totalRespondidas}</td>
                <td className="px-3 py-2.5 text-right" style={{ color: "var(--text-muted)" }}>
                  —
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
