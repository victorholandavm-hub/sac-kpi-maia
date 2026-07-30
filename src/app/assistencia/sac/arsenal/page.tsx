import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/dal";
import { searchArsenalEntries, listArsenalEntries, isArsenalCategory, ARSENAL_CATEGORIES, type ArsenalEntrySearchResult } from "@/lib/arsenalSac";
import { ARSENAL_CATEGORY_LABELS } from "@/lib/assistenciaLabels";
import { FilterSelect } from "@/components/assistencia/FilterSelect";
import { ArsenalEntryCard } from "@/components/assistencia/ArsenalEntryCard";
import { ArsenalEntryForm } from "@/components/assistencia/ArsenalEntryForm";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";

export const dynamic = "force-dynamic";

export default async function ArsenalSacPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; inactive?: string }>;
}) {
  const profile = await getProfile();
  if (profile.role !== "sac" && profile.role !== "admin") {
    redirect("/assistencia/inicio");
  }

  const { q, category, inactive } = await searchParams;
  const filterCategory = isArsenalCategory(category) ? category : undefined;
  const trimmedQ = (q ?? "").trim();
  // "mostrar inativas" só existe no modo listagem (sem busca) e só pro
  // admin -- o RPC de busca (search_arsenal_sac) é restrito a ativas de
  // propósito, ver 0046_arsenal_sac.sql.
  const showInactive = profile.role === "admin" && inactive === "1" && !trimmedQ;

  const results: ArsenalEntrySearchResult[] = trimmedQ
    ? await searchArsenalEntries(trimmedQ, filterCategory)
    : (await listArsenalEntries({ category: filterCategory, onlyActive: !showInactive })).map((e) => ({ ...e, rank: 0 }));

  const grouped = ARSENAL_CATEGORIES.map((cat) => ({
    category: cat,
    entries: results.filter((e) => e.category === cat),
  })).filter((g) => g.entries.length > 0);

  return (
    <div className="max-w-3xl mx-auto p-6 flex flex-col gap-6 w-full min-w-0">
      <AssistenciaHeader title="Arsenal do SAC" subtitle="Base de conhecimento — contatos, garantias e CDC" />

      <div className="flex items-center gap-2 flex-wrap">
        <FilterSelect
          name="category"
          placeholder="Todas as categorias"
          options={ARSENAL_CATEGORIES.map((c) => ({ value: c, label: ARSENAL_CATEGORY_LABELS[c] }))}
        />
        {profile.role === "admin" && !trimmedQ ? (
          <Link
            href={showInactive ? "/assistencia/sac/arsenal" : "/assistencia/sac/arsenal?inactive=1"}
            className="text-xs px-3 py-1.5 rounded-full border"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          >
            {showInactive ? "ocultar inativas" : "mostrar inativas"}
          </Link>
        ) : null}
      </div>

      <form action="/assistencia/sac/arsenal" method="GET" className="flex items-center gap-2 flex-wrap">
        {filterCategory ? <input type="hidden" name="category" value={filterCategory} /> : null}
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por assunto, contato, produto, artigo do CDC…"
          className="rounded border px-3 py-2 text-sm flex-1 min-w-[240px]"
          style={{ borderColor: "var(--border)" }}
        />
        <button type="submit" className="text-sm px-3 py-2 rounded border" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
          Buscar
        </button>
      </form>

      {profile.role === "admin" ? <ArsenalEntryForm /> : null}

      {grouped.length === 0 ? (
        <div className="rounded-lg border p-6 text-center" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {trimmedQ ? "Nada encontrado pra esse termo." : "Nenhuma entrada cadastrada ainda."}
          </p>
        </div>
      ) : (
        grouped.map((g) => (
          <div key={g.category} className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
              {ARSENAL_CATEGORY_LABELS[g.category]}
            </h2>
            <div className="flex flex-col gap-2">
              {g.entries.map((e) => (
                <ArsenalEntryCard key={e.id} entry={e} canEdit={profile.role === "admin"} />
              ))}
            </div>
          </div>
        ))
      )}

      <Link href="/assistencia/sac" className="text-sm underline self-center" style={{ color: "var(--text-secondary)" }}>
        ← Voltar
      </Link>
    </div>
  );
}
