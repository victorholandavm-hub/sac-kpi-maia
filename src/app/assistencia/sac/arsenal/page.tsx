import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/dal";
import { searchArsenalEntries, listArsenalEntries, isArsenalCategory, ARSENAL_CATEGORIES, type ArsenalEntrySearchResult } from "@/lib/arsenalSac";
import { ARSENAL_CATEGORY_LABELS, ARSENAL_CATEGORY_COLORS } from "@/lib/assistenciaLabels";
import { ArsenalEntryCard } from "@/components/assistencia/ArsenalEntryCard";
import { ArsenalEntryForm } from "@/components/assistencia/ArsenalEntryForm";
import { ArsenalCategorySection } from "@/components/assistencia/ArsenalCategorySection";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";

function buildHref(params: { q?: string; category?: string }): string {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.category) sp.set("category", params.category);
  const qs = sp.toString();
  return qs ? `/assistencia/sac/arsenal?${qs}` : "/assistencia/sac/arsenal";
}

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

      <form action="/assistencia/sac/arsenal" method="GET" className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-2">
        {filterCategory ? <input type="hidden" name="category" value={filterCategory} /> : null}
        <span className="pl-2 text-lg text-gray-400" aria-hidden>
          🔍
        </span>
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por assunto, contato, produto, artigo do CDC…"
          className="text-base flex-1 min-w-[200px] bg-transparent outline-none py-1.5 text-gray-800 placeholder:text-gray-400"
        />
        <button
          type="submit"
          className="text-sm px-4 py-2 rounded-lg font-semibold text-white shadow-sm transition-all duration-200 hover:brightness-110 whitespace-nowrap"
          style={{ background: "var(--brand-green)" }}
        >
          Buscar
        </button>
      </form>

      <div className="flex items-center gap-2 flex-wrap">
        <Link
          href={buildHref({ q })}
          className={`text-xs px-3.5 py-1.5 rounded-full font-medium transition-colors duration-150 ${
            !filterCategory ? "text-white" : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300"
          }`}
          style={!filterCategory ? { background: "var(--brand-green)" } : undefined}
        >
          Todas
        </Link>
        {ARSENAL_CATEGORIES.map((c) => {
          const active = filterCategory === c;
          const color = ARSENAL_CATEGORY_COLORS[c];
          return (
            <Link
              key={c}
              href={buildHref({ q, category: active ? undefined : c })}
              className="text-xs px-3.5 py-1.5 rounded-full font-medium whitespace-nowrap transition-colors duration-150"
              style={
                active
                  ? { color: "#fff", background: `color-mix(in srgb, ${color} 78%, black)`, border: "1px solid transparent" }
                  : { color: `color-mix(in srgb, ${color} 70%, black)`, background: "#fff", border: `1px solid ${color}` }
              }
            >
              {ARSENAL_CATEGORY_LABELS[c]}
            </Link>
          );
        })}
        {profile.role === "admin" && !trimmedQ ? (
          <Link
            href={showInactive ? "/assistencia/sac/arsenal" : "/assistencia/sac/arsenal?inactive=1"}
            className="text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors duration-150 ml-auto"
          >
            {showInactive ? "ocultar inativas" : "mostrar inativas"}
          </Link>
        ) : null}
      </div>

      {profile.role === "admin" ? <ArsenalEntryForm /> : null}

      {grouped.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-center">
          <p className="text-sm text-gray-400">{trimmedQ ? "Nada encontrado pra esse termo." : "Nenhuma entrada cadastrada ainda."}</p>
        </div>
      ) : (
        grouped.map((g) => (
          <ArsenalCategorySection
            key={g.category}
            label={ARSENAL_CATEGORY_LABELS[g.category]}
            count={g.entries.length}
            color={ARSENAL_CATEGORY_COLORS[g.category]}
            defaultOpen={!!trimmedQ}
          >
            {g.entries.map((e) => (
              <ArsenalEntryCard key={e.id} entry={e} canEdit={profile.role === "admin"} />
            ))}
          </ArsenalCategorySection>
        ))
      )}

      <Link href="/assistencia/sac" className="text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors duration-150 self-center">
        ← Voltar
      </Link>
    </div>
  );
}
