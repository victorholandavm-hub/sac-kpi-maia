import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/dal";
import { listCargasRecentes, type CargaGroup } from "@/lib/cargas";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";
import { SacTabs } from "@/components/assistencia/SacTabs";
import { CargaProblemaField } from "@/components/assistencia/CargaProblemaField";

export const dynamic = "force-dynamic";

function formatDate(value: string | null): string {
  if (!value) return "sem previsão";
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

function CargaCard({ group }: { group: CargaGroup }) {
  const totalProblemas = group.pedidos.reduce((n, p) => n + p.problemas.length, 0);

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
      <div className="flex items-start justify-between gap-3 flex-wrap p-4 pb-3" style={{ borderBottom: "1px solid var(--gridline)" }}>
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
              Carga {group.carga}
            </span>
            {group.statusCarga ? (
              <span
                className="text-xs font-medium px-2 py-0.5 rounded-full"
                style={{ background: "var(--gridline)", color: "var(--text-secondary)" }}
              >
                {group.statusCarga}
              </span>
            ) : null}
            {totalProblemas > 0 ? (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--status-critical)", color: "#fff" }}>
                {totalProblemas} problema{totalProblemas === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Previsão {formatDate(group.dtPrevisao)}
            {group.motoristaNome ? ` · Motorista: ${group.motoristaNome}` : ""}
          </span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {group.transportadora ? `${group.transportadora}` : ""}
            {group.veiculo ? ` · Veículo ${group.veiculo}` : ""}
          </span>
        </div>
      </div>

      <div className="divide-y" style={{ borderColor: "var(--gridline)" }}>
        {group.pedidos.map((p) => (
          <div key={p.cargaRowId} className="flex flex-col gap-2 p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                  Pedido {p.pedido} · Filial {p.filialVenda}
                </span>
                <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {p.clienteNome ?? "Cliente não identificado"}
                  {p.clienteCodigo ? (
                    <span className="text-xs font-mono font-normal" style={{ color: "var(--text-muted)" }}>
                      {" "}
                      #{p.clienteCodigo}
                    </span>
                  ) : null}
                </span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {p.clienteDocumento ?? "—"}
                  {p.loja ? ` · ${p.loja}` : ""}
                </span>
              </div>
              {p.statusEntrega ? (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0" style={{ background: "var(--gridline)", color: "var(--text-secondary)" }}>
                  {p.statusEntrega}
                </span>
              ) : null}
            </div>

            {p.ocorrenciaDescricao ? (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Ocorrência TOTVS: {p.ocorrenciaDescricao}
              </p>
            ) : null}

            <CargaProblemaField cargaRowId={p.cargaRowId} problemas={p.problemas} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function CargasPage() {
  const profile = await getProfile();
  if (profile.role !== "sac" && profile.role !== "admin") redirect("/assistencia/inicio");

  const grupos = await listCargasRecentes();

  return (
    <div className="max-w-3xl mx-auto p-6 flex flex-col gap-6 w-full min-w-0">
      <AssistenciaHeader title="Cargas" subtitle="Cargas dos últimos 30 dias — motorista, conferente e problemas encontrados." />

      <SacTabs active="cargas" />

      {grupos.length === 0 ? (
        <div className="rounded-lg border p-6 text-center" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Nenhuma carga nos últimos 30 dias.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {grupos.map((g) => (
            <CargaCard key={g.carga} group={g} />
          ))}
        </div>
      )}

      <Link href="/assistencia/sac" className="text-sm underline self-center" style={{ color: "var(--text-secondary)" }}>
        ← Voltar
      </Link>
    </div>
  );
}
