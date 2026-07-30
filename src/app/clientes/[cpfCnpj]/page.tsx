import Link from "next/link";
import { notFound } from "next/navigation";
import { getClientProfile } from "@/lib/customerProfile";
import { AppHeader } from "@/components/AppHeader";
import { ClientProfileHeader } from "@/components/ClientProfileHeader";
import { ClientSeasonalityChart } from "@/components/ClientSeasonalityChart";
import { ClientOrderHistoryTable } from "@/components/ClientOrderHistoryTable";
import { StatTile } from "@/components/StatTile";
import { BarRanking } from "@/components/BarRanking";

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

export default async function ClientProfilePage({
  params,
}: {
  params: Promise<{ cpfCnpj: string }>;
}) {
  const { cpfCnpj } = await params;
  const profile = await getClientProfile(cpfCnpj);
  if (!profile) notFound();

  return (
    <div className="max-w-6xl mx-auto p-6 flex flex-col gap-6">
      <AppHeader />
      <ClientProfileHeader client={profile.client} />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile label="Ticket médio" value={profile.stats.ticketMedio !== null ? formatBRL(profile.stats.ticketMedio) : "—"} accent="var(--brand-orange)" />
        <StatTile label="Nº de compras" value={profile.stats.totalCompras} accent="var(--brand-orange)" />
        <StatTile label="Valor total (bruto)" value={formatBRL(profile.stats.valorBruto)} accent="var(--brand-orange)" />
        <StatTile label="Última compra" value={formatDate(profile.stats.ultimaCompra)} accent="var(--brand-orange)" />
      </section>

      <section className="grid md:grid-cols-2 gap-4">
        <ClientSeasonalityChart data={profile.monthlyPattern} />
        <ClientOrderHistoryTable data={profile.orderHistory} />
      </section>

      <section className="grid md:grid-cols-2 gap-4">
        <BarRanking title="Produtos mais comprados (R$)" data={profile.topProducts} />
        <BarRanking title="Fabricantes mais comprados (R$)" data={profile.topManufacturers} />
      </section>

      <Link href="/clientes" className="text-sm underline self-center" style={{ color: "var(--text-secondary)" }}>
        ← Voltar
      </Link>
    </div>
  );
}
