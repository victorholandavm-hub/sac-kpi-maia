import Link from "next/link";
import { redirect } from "next/navigation";
import { getLojaGerenteSession } from "@/app/assistencia/loja-actions";
import { getGerenteStoreIds } from "@/lib/gerentes";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { listCaixasForStores } from "@/lib/caixas";
import { listAssemblersForStoresWithStoreName } from "@/lib/payments";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";
import { EquipeCaixaPinField } from "@/components/assistencia/EquipeCaixaPinField";
import { AddEquipeCaixaForm } from "@/components/assistencia/AddEquipeCaixaForm";
import { AddEquipeMontadorForm } from "@/components/assistencia/AddEquipeMontadorForm";
import { ToastProvider } from "@/components/assistencia/ToastProvider";

export const dynamic = "force-dynamic";

// Só as lojas do próprio gerente (getGerenteStoreIds) — nunca as outras,
// mesmo que ele tente forçar via URL, porque as actions em
// loja-equipe-actions.ts também re-verificam isso no servidor.
export default async function LojaEquipePage() {
  const gerenteName = await getLojaGerenteSession();
  if (!gerenteName) {
    redirect("/assistencia/loja/login");
  }

  const storeIds = await getGerenteStoreIds(gerenteName);
  const admin = getSupabaseAdmin();
  const [{ data: storesData }, caixas, assemblers] = await Promise.all([
    admin.from("stores").select("id, name").in("id", storeIds).order("name"),
    listCaixasForStores(storeIds),
    listAssemblersForStoresWithStoreName(storeIds),
  ]);
  const stores = storesData ?? [];

  return (
    <ToastProvider>
    {/* Largura total -- pedido do Victor 31/08/2026, mesmo tratamento
        das outras telas fora do grupo (app). */}
    <div className="w-full p-6 flex flex-col gap-6 min-w-0">
      <AssistenciaHeader title="Equipe da loja" subtitle="Cadastre a caixa que lança encomenda" />

      <Link href="/assistencia/loja" className="text-sm underline self-start text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
        ← Voltar
      </Link>

      <section className="rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-sm p-4 flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Caixas</h3>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Cada caixa tem seu próprio PIN e entra com nome + PIN em{" "}
          <span className="font-mono">/assistencia/encomendas/caixa/login</span>.
        </p>
        <ul className="flex flex-col gap-2">
          {caixas.map((c) => (
            <li key={c.name}>
              <EquipeCaixaPinField name={c.name} storeName={c.storeName} hasPin={c.hasPin} ativo={c.ativo} />
            </li>
          ))}
          {caixas.length === 0 ? <li className="text-sm text-gray-400 dark:text-gray-500">Nenhuma caixa cadastrada ainda.</li> : null}
        </ul>
        <AddEquipeCaixaForm stores={stores} />
      </section>

      <section className="rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-sm p-4 flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Montadores</h3>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Cadastre o montador da sua loja com PIN — ele entra com nome + PIN em{" "}
          <span className="font-mono">/assistencia/montador/login</span>.
        </p>
        <ul className="flex flex-col gap-2">
          {assemblers.map((a) => (
            <li key={a.name} className="text-sm text-gray-500 dark:text-gray-400">
              {a.name} <span className="text-gray-400 dark:text-gray-500">— {a.storeName ?? "disponível em todas as lojas"}</span>
            </li>
          ))}
          {assemblers.length === 0 ? <li className="text-sm text-gray-400 dark:text-gray-500">Nenhum montador cadastrado ainda.</li> : null}
        </ul>
        <AddEquipeMontadorForm stores={stores} />
      </section>
    </div>
    </ToastProvider>
  );
}
