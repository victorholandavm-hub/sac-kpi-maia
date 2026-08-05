import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/dal";
import { listEntregasEmRisco, listAtendentes, type EntregaRiscoItem, type EntregaRiscoAtendente } from "@/lib/entregasRisco";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";
import { EntregaRiscoNivelBadge } from "@/components/assistencia/EntregaRiscoNivelBadge";
import { EntregaRiscoClassificarField } from "@/components/assistencia/EntregaRiscoClassificarField";
import { EntregaRiscoAssignField } from "@/components/assistencia/EntregaRiscoAssignField";

export const dynamic = "force-dynamic";

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

function EntregaRiscoCard({ item, atendentes }: { item: EntregaRiscoItem; atendentes: EntregaRiscoAtendente[] }) {
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
              Pedido {item.pedido} · Filial {item.filialVenda}
            </span>
            <EntregaRiscoNivelBadge nivel={item.nivel} />
          </div>
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            {item.clienteNome ?? "Cliente não identificado"}
            {item.clienteCodigo ? (
              <span className="text-xs font-mono font-normal" style={{ color: "var(--text-muted)" }}>
                {" "}
                #{item.clienteCodigo}
              </span>
            ) : null}
          </span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {item.clienteDocumento ?? "—"}
            {item.clienteBairro || item.clienteMunicipio ? ` · ${[item.clienteBairro, item.clienteMunicipio, item.clienteUf].filter(Boolean).join(", ")}` : ""}
            {item.loja ? ` · ${item.loja}` : ""}
          </span>
        </div>
      </div>

      <p className="text-sm" style={{ color: "var(--text-primary)" }}>
        {item.motivo}
      </p>

      {item.cargaAtual ? (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Carga {item.cargaAtual.carga} · {item.cargaAtual.statusCarga ?? "—"}
          {item.cargaAtual.dtPrevisao ? ` · previsão ${formatDate(item.cargaAtual.dtPrevisao)}` : ""}
          {item.cargaAtual.motoristaNome ? ` · ${item.cargaAtual.motoristaNome}` : ""}
          {item.cargaAtual.transportadora ? ` · ${item.cargaAtual.transportadora}` : ""}
        </p>
      ) : null}

      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        {item.baselineOrigem === "nota_fiscal" ? `Venda em ${formatDate(item.baselineData)} (nota fiscal)` : `Visto pela 1ª vez em ${formatDate(item.baselineData)} (estimado)`}
      </p>

      <EntregaRiscoAssignField pedido={item.pedido} filialVenda={item.filialVenda} assignedTo={item.assignedTo} atendentes={atendentes} />
      <EntregaRiscoClassificarField pedido={item.pedido} filialVenda={item.filialVenda} classificacao={item.classificacao} />
    </div>
  );
}

function Section({
  title,
  items,
  atendentes,
  emptyMessage,
}: {
  title: string;
  items: EntregaRiscoItem[];
  atendentes: EntregaRiscoAtendente[];
  emptyMessage: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
        {title} ({items.length})
      </h3>
      {items.length === 0 ? (
        <div className="rounded-lg border p-6 text-center" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {emptyMessage}
          </p>
        </div>
      ) : (
        <div className="rounded-lg overflow-hidden" style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}>
          <div className="divide-y" style={{ borderColor: "var(--gridline)" }}>
            {items.map((item) => (
              <EntregaRiscoCard key={`${item.pedido}-${item.filialVenda}`} item={item} atendentes={atendentes} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default async function EntregasRiscoPage() {
  const profile = await getProfile();
  if (profile.role !== "sac" && profile.role !== "admin") redirect("/assistencia/inicio");

  const [items, atendentes] = await Promise.all([listEntregasEmRisco(), listAtendentes()]);
  const alertas = items.filter((i) => i.nivel === "alerta");
  const acompanhamentos = items.filter((i) => i.nivel === "acompanhamento");

  return (
    <div className="max-w-3xl mx-auto p-6 flex flex-col gap-6 w-full min-w-0">
      <AssistenciaHeader title="Entregas em risco" subtitle="Pedidos que podem atrasar — verifique a situação e avise o cliente antes do prazo." />

      <Section title="Alerta" items={alertas} atendentes={atendentes} emptyMessage="Nenhum pedido em alerta no momento." />
      <Section title="Acompanhamento" items={acompanhamentos} atendentes={atendentes} emptyMessage="Nenhum pedido em acompanhamento no momento." />

      <Link href="/assistencia/sac" className="text-sm underline self-center" style={{ color: "var(--text-secondary)" }}>
        ← Voltar
      </Link>
    </div>
  );
}
