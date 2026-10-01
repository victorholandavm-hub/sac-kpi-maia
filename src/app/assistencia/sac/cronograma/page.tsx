import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/dal";
import { ROLE_LABELS } from "@/lib/assistenciaLabels";
import { getCronogramaDia, getCronogramaMatrizDia, getCronogramaTaxaCumprimento, todayFortaleza } from "@/lib/cronogramaSac";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";
import { SacTabs } from "@/components/assistencia/SacTabs";
import { ToastProvider } from "@/components/assistencia/ToastProvider";
import { CronogramaChecklist } from "@/components/assistencia/CronogramaChecklist";
import { formatDateTimeShortBr } from "@/lib/formatDateTime";

export const dynamic = "force-dynamic";

function addDays(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function formatDiaBr(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

// Painel de controle pro admin -- matriz atendente x item do dia, com
// navegação pra dias passados, e a taxa de cumprimento dos últimos N dias.
// Só leitura: admin não marca em nome de ninguém (mantém a
// responsabilidade de cada atendente pelo próprio checklist, ver
// cronograma-actions.ts).
async function AdminView({ data }: { data: string }) {
  const [{ itens, atendentes }, taxa30] = await Promise.all([getCronogramaMatrizDia(data), getCronogramaTaxaCumprimento(30)]);
  const isToday = data === todayFortaleza();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Link
          href={`/assistencia/sac/cronograma?data=${addDays(data, -1)}`}
          className="text-sm px-3 py-1.5 rounded-lg border font-medium"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          ← Dia anterior
        </Link>
        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {formatDiaBr(data)}
          {isToday ? " · Hoje" : ""}
        </span>
        {!isToday ? (
          <Link href="/assistencia/sac/cronograma" className="text-xs underline" style={{ color: "var(--text-secondary)" }}>
            Voltar pra hoje
          </Link>
        ) : null}
        <Link
          href={`/assistencia/sac/cronograma?data=${addDays(data, 1)}`}
          className="text-sm px-3 py-1.5 rounded-lg border font-medium"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          Dia seguinte →
        </Link>
      </div>

      {itens.length === 0 || atendentes.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {itens.length === 0 ? "Nenhum item ativo no cronograma." : "Nenhum atendente do SAC cadastrado ainda."}
        </p>
      ) : (
        <div className="rounded-xl border overflow-x-auto" style={{ borderColor: "var(--border)" }}>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                <th className="text-left px-3 py-2 font-semibold whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                  Atendente
                </th>
                {itens.map((item) => (
                  <th key={item.id} className="text-center px-3 py-2 font-semibold whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                    <div className="font-mono text-xs">{item.horario}</div>
                    <div className="text-[11px] font-normal max-w-[140px]" style={{ color: "var(--text-muted)" }} title={item.descricao}>
                      {item.descricao.length > 36 ? `${item.descricao.slice(0, 36)}…` : item.descricao}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {atendentes.map((at) => (
                <tr key={at.profileId} className="border-b" style={{ borderColor: "var(--border)" }}>
                  <td className="px-3 py-2 font-medium whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
                    {at.fullName}
                  </td>
                  {at.celulas.map((cel) => (
                    <td key={cel.itemId} className="text-center px-3 py-2">
                      {cel.completedAt ? (
                        <span title={formatDateTimeShortBr(cel.completedAt)} style={{ color: "var(--status-good)" }}>
                          ✅ {cel.completedAt.slice(11, 16)}
                        </span>
                      ) : cel.atrasado ? (
                        <span className="font-semibold" style={{ color: "var(--status-critical)" }}>
                          🔴 atrasado
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>⚪</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Taxa de cumprimento — últimos 30 dias
        </h3>
        {taxa30.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Nenhum atendente do SAC cadastrado ainda.
          </p>
        ) : (
          <div className="rounded-xl border overflow-x-auto" style={{ borderColor: "var(--border)" }}>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                  <th className="text-left px-3 py-2 font-semibold" style={{ color: "var(--text-secondary)" }}>
                    Atendente
                  </th>
                  <th className="text-right px-3 py-2 font-semibold" style={{ color: "var(--text-secondary)" }}>
                    Itens cumpridos
                  </th>
                  <th className="text-right px-3 py-2 font-semibold" style={{ color: "var(--text-secondary)" }}>
                    %
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...taxa30]
                  .sort((a, b) => b.pct - a.pct)
                  .map((t) => (
                    <tr key={t.profileId} className="border-b" style={{ borderColor: "var(--border)" }}>
                      <td className="px-3 py-2" style={{ color: "var(--text-primary)" }}>
                        {t.fullName}
                      </td>
                      <td className="text-right px-3 py-2" style={{ color: "var(--text-secondary)" }}>
                        {t.concluidos} / {t.esperados}
                      </td>
                      <td
                        className="text-right px-3 py-2 font-semibold"
                        style={{ color: t.pct >= 80 ? "var(--status-good)" : t.pct >= 50 ? "var(--status-warning)" : "var(--status-critical)" }}
                      >
                        {t.pct}%
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default async function CronogramaPage({ searchParams }: { searchParams: Promise<{ data?: string }> }) {
  const profile = await getProfile();
  if (profile.role !== "sac" && profile.role !== "admin") {
    redirect("/assistencia/inicio");
  }

  const { data } = await searchParams;
  const today = todayFortaleza();
  const selectedDate = data && /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : today;
  const isAdminView = profile.role === "admin";

  const personalItens = isAdminView ? null : await getCronogramaDia(profile.id, today);

  return (
    <ToastProvider>
      <div className="max-w-5xl mx-auto w-full p-6 flex flex-col gap-4 min-w-0">
        <AssistenciaHeader title="Cronograma Diário do SAC" subtitle={`${profile.fullName} · ${ROLE_LABELS[profile.role] ?? profile.role}`} />
        <SacTabs active="cronograma" />

        {isAdminView ? (
          <AdminView data={selectedDate} />
        ) : (
          <div className="flex flex-col gap-3 max-w-xl">
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Checklist de hoje ({formatDiaBr(today)}). Marque cada item conforme for fazendo durante o dia.
            </p>
            <CronogramaChecklist itens={personalItens!} editable />
          </div>
        )}
      </div>
    </ToastProvider>
  );
}
