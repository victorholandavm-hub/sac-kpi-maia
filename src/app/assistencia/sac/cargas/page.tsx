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
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-start justify-between gap-3 flex-wrap p-4 pb-3 border-b border-gray-100">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-800">Carga {group.carga}</span>
            {group.statusCarga ? <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{group.statusCarga}</span> : null}
            {totalProblemas > 0 ? (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: "var(--status-critical)" }}>
                {totalProblemas} problema{totalProblemas === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>
          <span className="text-xs text-gray-400">
            Previsão {formatDate(group.dtPrevisao)}
            {group.motoristaNome ? ` · Motorista: ${group.motoristaNome}` : ""}
          </span>
          <span className="text-xs text-gray-400">
            {group.transportadora ? `${group.transportadora}` : ""}
            {group.veiculo ? ` · Veículo ${group.veiculo}` : ""}
          </span>
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        {group.pedidos.map((p) => (
          <div key={p.cargaRowId} className="flex flex-col gap-2 p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-xs font-mono text-gray-400">
                  Pedido {p.pedido} · Filial {p.filialVenda}
                </span>
                <span className="text-sm font-medium text-gray-800">
                  {p.clienteNome ?? "Cliente não identificado"}
                  {p.clienteCodigo ? <span className="text-xs font-mono font-normal text-gray-400"> #{p.clienteCodigo}</span> : null}
                </span>
                <span className="text-xs text-gray-400">
                  {p.clienteDocumento ?? "—"}
                  {p.loja ? ` · ${p.loja}` : ""}
                </span>
              </div>
              {p.statusEntrega ? <span className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0 bg-gray-100 text-gray-500">{p.statusEntrega}</span> : null}
            </div>

            {p.ocorrenciaDescricao ? <p className="text-xs text-gray-400">Ocorrência TOTVS: {p.ocorrenciaDescricao}</p> : null}

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
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-center">
          <p className="text-sm text-gray-400">Nenhuma carga nos últimos 30 dias.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {grupos.map((g) => (
            <CargaCard key={g.carga} group={g} />
          ))}
        </div>
      )}

      <Link href="/assistencia/sac" className="text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors duration-150 self-center">
        ← Voltar
      </Link>
    </div>
  );
}
