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
    <div className="max-w-3xl mx-auto p-6 flex flex-col gap-6 w-full min-w-0">
      <AssistenciaHeader title="Equipe da loja" subtitle="Cadastre a caixa que lança encomenda" />

      <Link href="/assistencia/loja" className="text-sm underline self-start" style={{ color: "var(--text-secondary)" }}>
        ← Voltar
      </Link>

      <section
        className="rounded-lg p-4 flex flex-col gap-2"
        style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}
      >
        <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
          Caixas
        </h3>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Cada caixa tem seu próprio PIN e entra com nome + PIN em{" "}
          <span className="font-mono">/assistencia/encomendas/caixa/login</span>.
        </p>
        <ul className="flex flex-col gap-2">
          {caixas.map((c) => (
            <li key={c.name}>
              <EquipeCaixaPinField name={c.name} storeName={c.storeName} hasPin={c.hasPin} ativo={c.ativo} />
            </li>
          ))}
          {caixas.length === 0 ? (
            <li className="text-sm" style={{ color: "var(--text-muted)" }}>
              Nenhuma caixa cadastrada ainda.
            </li>
          ) : null}
        </ul>
        <AddEquipeCaixaForm stores={stores} />
      </section>

      <section
        className="rounded-lg p-4 flex flex-col gap-2"
        style={{ background: "var(--surface-1)", border: "2px solid var(--brand-green)" }}
      >
        <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
          Montadores
        </h3>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Cadastre o montador da sua loja com PIN — ele entra com nome + PIN em{" "}
          <span className="font-mono">/assistencia/montador/login</span>.
        </p>
        <ul className="flex flex-col gap-2">
          {assemblers.map((a) => (
            <li key={a.name} className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {a.name}{" "}
              <span style={{ color: "var(--text-muted)" }}>
                — {a.storeName ?? "disponível em todas as lojas"}
              </span>
            </li>
          ))}
          {assemblers.length === 0 ? (
            <li className="text-sm" style={{ color: "var(--text-muted)" }}>
              Nenhum montador cadastrado ainda.
            </li>
          ) : null}
        </ul>
        <AddEquipeMontadorForm stores={stores} />
      </section>
    </div>
    </ToastProvider>
  );
}
