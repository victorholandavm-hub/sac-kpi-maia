import Link from "next/link";
import { listClientSegments, type ClientCategory } from "@/lib/customerProfile";
import { AppHeader } from "@/components/AppHeader";
import { ClientSearch } from "@/components/ClientSearch";
import { ClientSegmentTable } from "@/components/ClientSegmentTable";
import { StatTile } from "@/components/StatTile";
import { BarRanking } from "@/components/BarRanking";

export const dynamic = "force-dynamic";

function isClientCategory(value: string | undefined): value is ClientCategory {
  return value === "neighborhood" || value === "city";
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ by?: string }>;
}) {
  const { by } = await searchParams;
  const groupBy: ClientCategory = isClientCategory(by) ? by : "neighborhood";
  const segments = await listClientSegments(groupBy);

  const totalClientes = segments.reduce((sum, s) => sum + s.clientCount, 0);
  const totalRevenue = segments.reduce((sum, s) => sum + s.totalRevenue, 0);
  const totalCompras = segments.reduce((sum, s) => sum + s.totalCompras, 0);
  const ticketGeral = totalCompras > 0 ? totalRevenue / totalCompras : 0;

  const groupLabel = groupBy === "neighborhood" ? "Bairro" : "Cidade";
  const byRevenue = segments.slice(0, 10).map((s) => ({ label: s.key, count: Math.round(s.totalRevenue) }));
  const byTicket = [...segments]
    .sort((a, b) => b.avgTicket - a.avgTicket)
    .slice(0, 10)
    .map((s) => ({ label: s.key, count: Math.round(s.avgTicket) }));

  return (
    <div className="max-w-5xl mx-auto p-6 flex flex-col gap-6">
      <AppHeader />
      <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
        Perfil do Cliente
      </h1>

      <ClientSearch />

      <div className="flex items-center gap-2">
        <Link
          href="/clientes?by=neighborhood"
          className="text-sm px-3 py-1.5 rounded-full"
          style={{
            background: groupBy === "neighborhood" ? "var(--brand-orange)" : "transparent",
            color: groupBy === "neighborhood" ? "#fff" : "var(--text-secondary)",
            fontWeight: groupBy === "neighborhood" ? 600 : 400,
            border: "1px solid var(--border)",
          }}
        >
          Por bairro
        </Link>
        <Link
          href="/clientes?by=city"
          className="text-sm px-3 py-1.5 rounded-full"
          style={{
            background: groupBy === "city" ? "var(--brand-orange)" : "transparent",
            color: groupBy === "city" ? "#fff" : "var(--text-secondary)",
            fontWeight: groupBy === "city" ? 600 : 400,
            border: "1px solid var(--border)",
          }}
        >
          Por cidade
        </Link>
      </div>

      <section className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatTile label="Clientes com compra" value={totalClientes} accent="var(--brand-orange)" />
        <StatTile label="Valor total (bruto)" value={formatBRL(totalRevenue)} accent="var(--brand-orange)" />
        <StatTile label="Ticket médio geral" value={formatBRL(ticketGeral)} accent="var(--brand-orange)" />
      </section>

      <section className="grid md:grid-cols-2 gap-4">
        <BarRanking title={`Valor total por ${groupLabel.toLowerCase()} (top 10)`} data={byRevenue} />
        <BarRanking title={`Ticket médio por ${groupLabel.toLowerCase()} (top 10)`} data={byTicket} />
      </section>

      <ClientSegmentTable data={segments} groupLabel={groupLabel} />
    </div>
  );
}
