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

      <form
        action="/assistencia/sac/arsenal"
        method="GET"
        className="flex items-center gap-2 rounded-lg border p-2"
        style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
      >
        {filterCategory ? <input type="hidden" name="category" value={filterCategory} /> : null}
        <span className="pl-2 text-lg" aria-hidden>
          🔍
        </span>
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por assunto, contato, produto, artigo do CDC…"
          className="text-base flex-1 min-w-[200px] bg-transparent outline-none py-1.5"
          style={{ color: "var(--text-primary)" }}
        />
        <button
          type="submit"
          className="text-sm px-4 py-2 rounded font-medium whitespace-nowrap"
          style={{ background: "var(--brand-green)", color: "var(--brand-green-ink)" }}
        >
          Buscar
        </button>
      </form>

      <div className="flex items-center gap-2 flex-wrap">
        <Link
          href={buildHref({ q })}
          className="text-xs px-3 py-1.5 rounded-full border font-medium"
          style={{
            borderColor: "var(--border)",
            background: !filterCategory ? "var(--surface-1)" : "transparent",
            color: !filterCategory ? "var(--text-primary)" : "var(--text-secondary)",
          }}
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
              className="text-xs px-3 py-1.5 rounded-full border font-medium whitespace-nowrap"
              style={{
                borderColor: active ? color : "var(--border)",
                background: active ? `color-mix(in srgb, ${color} 14%, var(--surface-1))` : "transparent",
                color: active ? color : "var(--text-secondary)",
                fontWeight: active ? 600 : 400,
              }}
            >
              {ARSENAL_CATEGORY_LABELS[c]}
            </Link>
          );
        })}
        {profile.role === "admin" && !trimmedQ ? (
          <Link
            href={showInactive ? "/assistencia/sac/arsenal" : "/assistencia/sac/arsenal?inactive=1"}
            className="text-xs px-3 py-1.5 rounded-full border ml-auto"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          >
            {showInactive ? "ocultar inativas" : "mostrar inativas"}
          </Link>
        ) : null}
      </div>

      {profile.role === "admin" ? <ArsenalEntryForm /> : null}

      {grouped.length === 0 ? (
        <div className="rounded-lg border p-6 text-center" style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {trimmedQ ? "Nada encontrado pra esse termo." : "Nenhuma entrada cadastrada ainda."}
          </p>
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

      <Link href="/assistencia/sac" className="text-sm underline self-center" style={{ color: "var(--text-secondary)" }}>
        ← Voltar
      </Link>
    </div>
  );
}
