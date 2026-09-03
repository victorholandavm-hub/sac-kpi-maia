import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/dal";
import { listEntregasEmRisco, listAtendentes, type EntregaRiscoItem, type EntregaRiscoAtendente } from "@/lib/entregasRisco";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";
import { EntregaRiscoNivelBadge } from "@/components/assistencia/EntregaRiscoNivelBadge";
import { EntregaRiscoClassificarField } from "@/components/assistencia/EntregaRiscoClassificarField";
import { EntregaRiscoAssignField } from "@/components/assistencia/EntregaRiscoAssignField";

export const dynamic = "force-dynamic";

// A partir de quantos dias sem re-sincronizar um alerta passa a valer menos
// confiança -- descoberto em 2026-08-10: dois pedidos já entregues no
// Protheus continuaram aparecendo como risco porque o job de sync (roda numa
// máquina fora daqui, ver scripts/totvs-sync.ts) ficou dias sem rodar e o
// snapshot local nunca foi atualizado. 2 dias cobre folga de fim de semana
// sem já soar falso alarme numa segunda-feira normal.
const SYNC_STALE_WARNING_DAYS = 2;

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

function diasDesde(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
}

function SyncStaleness({ syncedAt }: { syncedAt: string }) {
  const dias = diasDesde(syncedAt);
  const stale = dias >= SYNC_STALE_WARNING_DAYS;
  return (
    <p className={`text-xs ${stale ? "font-semibold" : "text-gray-400 dark:text-gray-500"}`} style={stale ? { color: "var(--status-critical)" } : undefined}>
      {stale
        ? `⚠ Dado da TOTVS sem atualizar há ${dias} dias — confira direto no Protheus antes de agir.`
        : dias === 0
          ? "Dado da TOTVS sincronizado hoje."
          : `Dado da TOTVS sincronizado há ${dias} dia${dias === 1 ? "" : "s"}.`}
    </p>
  );
}

function EntregaRiscoCard({ item, atendentes }: { item: EntregaRiscoItem; atendentes: EntregaRiscoAtendente[] }) {
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-gray-400 dark:text-gray-500">
              Pedido {item.pedido} · Filial {item.filialVenda}
            </span>
            <EntregaRiscoNivelBadge nivel={item.nivel} />
          </div>
          <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
            {item.clienteNome ?? "Cliente não identificado"}
            {item.clienteCodigo ? <span className="text-xs font-mono font-normal text-gray-400 dark:text-gray-500"> #{item.clienteCodigo}</span> : null}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {item.clienteDocumento ?? "—"}
            {item.clienteBairro || item.clienteMunicipio ? ` · ${[item.clienteBairro, item.clienteMunicipio, item.clienteUf].filter(Boolean).join(", ")}` : ""}
            {item.loja ? ` · ${item.loja}` : ""}
          </span>
        </div>
      </div>

      <p className="text-sm text-gray-800 dark:text-gray-100">{item.motivo}</p>

      {item.cargaAtual ? (
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Carga {item.cargaAtual.carga} · {item.cargaAtual.statusCarga ?? "—"}
          {item.cargaAtual.dtPrevisao ? ` · previsão ${formatDate(item.cargaAtual.dtPrevisao)}` : ""}
          {item.cargaAtual.motoristaNome ? ` · ${item.cargaAtual.motoristaNome}` : ""}
          {item.cargaAtual.transportadora ? ` · ${item.cargaAtual.transportadora}` : ""}
        </p>
      ) : null}

      <p className="text-xs text-gray-400 dark:text-gray-500">
        {item.baselineOrigem === "nota_fiscal" ? `Venda em ${formatDate(item.baselineData)} (nota fiscal)` : `Visto pela 1ª vez em ${formatDate(item.baselineData)} (estimado)`}
      </p>
      <SyncStaleness syncedAt={item.syncedAt} />

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
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
        {title} ({items.length})
      </h3>
      {items.length === 0 ? (
        <div className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-6 text-center">
          <p className="text-sm text-gray-400 dark:text-gray-500">{emptyMessage}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
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
    <div className="w-full p-6 flex flex-col gap-6 min-w-0">
      <AssistenciaHeader title="Entregas em risco" subtitle="Pedidos que podem atrasar — verifique a situação e avise o cliente antes do prazo." />

      <Section title="Alerta" items={alertas} atendentes={atendentes} emptyMessage="Nenhum pedido em alerta no momento." />
      <Section title="Acompanhamento" items={acompanhamentos} atendentes={atendentes} emptyMessage="Nenhum pedido em acompanhamento no momento." />

      <Link href="/assistencia/sac" className="text-sm font-medium text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-150 self-center">
        ← Voltar
      </Link>
    </div>
  );
}
