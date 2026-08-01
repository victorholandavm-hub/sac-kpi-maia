import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { requireDashboardAuth } from "@/lib/dashboardSession";

export default async function Home() {
  await requireDashboardAuth();
  return (
    <div className="max-w-3xl mx-auto p-6 flex flex-col gap-6">
      <AppHeader />
      <div className="grid gap-4 w-full max-w-sm">
        <Link
          href="/kpis"
          className="rounded-xl border p-6 flex flex-col gap-2"
          style={{ background: "var(--surface-1)", borderColor: "var(--border)", borderTop: "3px solid var(--brand-orange)" }}
        >
          <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
            KPIs
          </h2>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Indicadores de atendimento do SAC.
          </p>
        </Link>
      </div>
    </div>
  );
}
