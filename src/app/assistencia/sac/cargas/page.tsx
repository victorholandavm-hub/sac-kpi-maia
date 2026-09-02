import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/dal";
import { listCargasRecentes, listPedidosSemCarga, type CargaGroup, type PedidoSemCarga } from "@/lib/cargas";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";
import { SacTabs } from "@/components/assistencia/SacTabs";
import { CargaProblemaField } from "@/components/assistencia/CargaProblemaField";

export const dynamic = "force-dynamic";

function formatDate(value: string | null): string {
  if (!value) return "sem previsão";
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

function diasDesde(value: string): number {
  return Math.floor((Date.now() - new Date(`${value}T00:00:00`).getTime()) / (24 * 60 * 60 * 1000));
}

// "Pendente de carga" -- pedido do Victor 02/09/2026: "clientes que
// compraram nos últimos 5 dias e ainda não estão em carga". Seção nova, ao
// lado da lista de cargas já despachadas (que continua igual, com
// motorista/problemas) -- não substitui, complementa: aqui é quem ainda nem
// entrou numa viagem.
function PendenteCargaTable({ pedidos }: { pedidos: PedidoSemCarga[] }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden overflow-x-auto">
      <table className="w-full border-collapse text-sm" style={{ minWidth: "640px" }}>
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            {["Pedido / Filial", "Cliente", "Loja", "Comprado em", ""].map((h) => (
              <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {pedidos.map((p) => {
            const dias = diasDesde(p.compradoEm);
            return (
              <tr key={`${p.pedido}-${p.filialVenda}`} className="hover:bg-gray-50 transition-colors duration-150">
                <td className="px-4 py-3 align-top whitespace-nowrap font-mono text-xs text-gray-400">
                  {p.pedido} · {p.filialVenda}
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="font-medium text-gray-800 truncate">{p.clienteNome ?? "Cliente não identificado"}</div>
                  <div className="text-xs text-gray-400">{p.clienteDocumento ?? "—"}</div>
                </td>
                <td className="px-4 py-3 align-top text-gray-600 whitespace-nowrap">{p.loja ?? "—"}</td>
                <td className="px-4 py-3 align-top whitespace-nowrap">
                  <span className="text-gray-800">{formatDate(p.compradoEm)}</span>
                  <span
                    className="ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap"
                    style={
                      dias >= 3
                        ? { color: "color-mix(in srgb, var(--status-critical) 70%, black)", background: "color-mix(in srgb, var(--status-critical) 14%, white)" }
                        : { background: "#F3F4F6", color: "#6B7280" }
                    }
                  >
                    {dias === 0 ? "hoje" : `${dias}d`}
                  </span>
                </td>
                <td className="px-4 py-3 align-top text-right text-xs text-gray-400 whitespace-nowrap">{p.statusAtual ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
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

  const [grupos, pendentes] = await Promise.all([listCargasRecentes(), listPedidosSemCarga()]);

  return (
    <div className="w-full p-6 flex flex-col gap-6 min-w-0">
      <AssistenciaHeader title="Cargas" subtitle="Cargas dos últimos 30 dias — motorista, conferente e problemas encontrados." />

      <SacTabs active="cargas" />

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-gray-800">
          Pendente de carga <span className="font-normal text-gray-400">({pendentes.length})</span>
        </h2>
        <p className="text-xs text-gray-400">Comprou nos últimos 5 dias e ainda não entrou em nenhuma carga/viagem.</p>
        {pendentes.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-6 text-center">
            <p className="text-sm text-gray-400">Nenhum pedido pendente de carga nos últimos 5 dias.</p>
          </div>
        ) : (
          <PendenteCargaTable pedidos={pendentes} />
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-gray-800">Cargas em andamento</h2>
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
      </div>

      <Link href="/assistencia/sac" className="text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors duration-150 self-center">
        ← Voltar
      </Link>
    </div>
  );
}
