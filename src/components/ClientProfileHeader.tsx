import type { ClientSummary } from "@/lib/customerProfile";

const STATUS_LABELS: Record<string, string> = {
  ativo: "Ativo",
  inativo: "Inativo",
  "nunca comprou": "Nunca comprou",
  "sem cadastro": "Sem cadastro no TOTVS",
};

export function ClientProfileHeader({ client }: { client: ClientSummary }) {
  return (
    <div className="rounded-lg border p-4 flex flex-col gap-1" style={{ background: "var(--surface-1)", borderColor: "var(--border)", borderTop: "3px solid var(--brand-orange)" }}>
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
          {client.name}
        </h2>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--background)", color: "var(--text-muted)" }}>
          {STATUS_LABELS[client.status] ?? client.status}
        </span>
      </div>
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        {client.cpfCnpj} · {client.neighborhood ?? "Bairro não informado"}
        {client.city ? `, ${client.city}` : ""}
      </p>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        {client.phone1 ? `Tel: ${client.phone1}` : "Sem telefone cadastrado"}
        {client.daysWithoutBuying !== null ? ` · ${client.daysWithoutBuying} dias sem comprar` : ""}
      </p>
    </div>
  );
}
