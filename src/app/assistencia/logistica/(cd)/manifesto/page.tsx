import { listarManifesto, mensagemDeErro, type CargaManifesto } from "@/lib/odoo/logistica";
import { empresaDaUrl } from "@/lib/odoo/logisticaAuth";
import { ErroOdoo } from "@/components/logisticaOdoo/ui";
import { ManifestoBoard } from "@/components/logisticaOdoo/ManifestoBoard";

// 26/10/2026 (Pedro): manifesto de carga (MDF-e) — obrigatório para o caminhão que leva a nota de transferência
// (abastecimento / retira ABA) e para as entregas que precisem. Notas da carga: a 5152 (todos os produtos) + a de cada cliente.
export const dynamic = "force-dynamic";

export default async function ManifestoPage({ searchParams }: { searchParams: Promise<{ empresa?: string }> }) {
  const sp = await searchParams;
  const empresa = empresaDaUrl(sp.empresa);
  let cargas: CargaManifesto[] = [], erro = "";
  try { cargas = await listarManifesto(empresa); } catch (e) { erro = mensagemDeErro(e); }
  return (
    <div className="flex flex-col gap-4 min-w-0">
      <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Manifesto de carga (MDF-e)</h2>
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        Cargas liberadas, em rota ou finalizadas nos últimos 7 dias. Depois de &quot;Sair em rota&quot;, abra a carga para ver as notas
        (a de transferência com todos os produtos do caminhão e a de cada cliente), imprimir tudo num PDF e emitir o manifesto.
      </p>
      {erro ? <ErroOdoo titulo="Não consegui ler as cargas" mensagem={erro} /> : <ManifestoBoard cargas={cargas} />}
    </div>
  );
}
