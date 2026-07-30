// Extensão .ts explícita no import (permitida por allowImportingTsExtensions
// no tsconfig): este arquivo é usado tanto pelo Next.js quanto rodado direto
// via `node` em scripts/seed-arsenal.ts, que exige extensão explícita em
// imports relativos (mesmo motivo de src/lib/totvsSync.ts).
import { getSupabaseAdmin } from "./supabaseAdmin.ts";

// Categorias fixas -- refletem como o time de SAC organiza a base de
// conhecimento (ver 0046_arsenal_sac.sql pro check constraint espelhado).
export const ARSENAL_CATEGORIES = ["contatos_internos", "fornecedores", "processos", "garantias", "cdc"] as const;

export type ArsenalCategory = (typeof ARSENAL_CATEGORIES)[number];

export function isArsenalCategory(value: string | undefined | null): value is ArsenalCategory {
  return !!value && (ARSENAL_CATEGORIES as readonly string[]).includes(value);
}

export type ArsenalEntry = {
  id: string;
  category: ArsenalCategory;
  slug: string;
  title: string;
  body: string;
  keywords: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ArsenalEntrySearchResult = ArsenalEntry & { rank: number };

type ArsenalEntryRow = {
  id: string;
  category: string;
  slug: string;
  title: string;
  body: string;
  keywords: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

const ENTRY_COLUMNS = "id, category, slug, title, body, keywords, active, created_at, updated_at";

function toArsenalEntry(row: ArsenalEntryRow): ArsenalEntry {
  return {
    id: row.id,
    category: row.category as ArsenalCategory,
    slug: row.slug,
    title: row.title,
    body: row.body,
    keywords: row.keywords,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Chave natural pro upsert idempotente em scripts/seed-arsenal.ts e pra
// gerar o slug de uma entrada nova cadastrada pela UI. Puro (sem I/O) pra
// dar pra testar e reaproveitar do script standalone sem duplicar lógica.
// IMPORTANTE: nunca é recalculado num update (ver updateArsenalEntry) --
// é a chave estável que permite reimportar uma versão futura do documento
// sem duplicar uma entrada só porque o título mudou.
export function buildArsenalSlug(category: string, title: string): string {
  const normalized = title
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${category}-${normalized}`;
}

export async function listArsenalEntries(
  opts: { category?: ArsenalCategory; onlyActive?: boolean } = {}
): Promise<ArsenalEntry[]> {
  const admin = getSupabaseAdmin();
  let query = admin.from("arsenal_sac_entries").select(ENTRY_COLUMNS).order("category").order("title");
  if (opts.category) query = query.eq("category", opts.category);
  if (opts.onlyActive) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as ArsenalEntryRow[]).map(toArsenalEntry);
}

// Busca por texto livre via RPC search_arsenal_sac (full-text search +
// unaccent, ver 0046_arsenal_sac.sql) -- só entre entradas ativas (ver
// comentário no RPC). Termo vazio/só espaços cai pra listagem normal:
// websearch_to_tsquery de string vazia não dá erro mas também não bate com
// nada, então tratamos aqui em vez de fazer round-trip ao Postgres à toa.
export async function searchArsenalEntries(query: string, category?: ArsenalCategory): Promise<ArsenalEntrySearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    const entries = await listArsenalEntries({ category, onlyActive: true });
    return entries.map((e) => ({ ...e, rank: 0 }));
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.rpc("search_arsenal_sac", {
    search_query: trimmed,
    category_filter: category ?? null,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as (ArsenalEntryRow & { rank: number })[]).map((row) => ({
    ...toArsenalEntry(row),
    rank: row.rank,
  }));
}

export type ArsenalEntryInput = {
  category: ArsenalCategory;
  title: string;
  body: string;
  keywords: string | null;
};

export async function createArsenalEntry(input: ArsenalEntryInput): Promise<void> {
  const admin = getSupabaseAdmin();
  const slug = buildArsenalSlug(input.category, input.title);
  const { error } = await admin.from("arsenal_sac_entries").insert({
    category: input.category,
    slug,
    title: input.title.trim(),
    body: input.body.trim(),
    keywords: input.keywords?.trim() || null,
  });
  if (error) throw new Error(error.message);
}

// Atualiza conteúdo de uma entrada já existente -- categoria/título/corpo
// são editáveis, mas o slug NUNCA é recalculado aqui (ver buildArsenalSlug).
export async function updateArsenalEntry(id: string, input: ArsenalEntryInput): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("arsenal_sac_entries")
    .update({
      category: input.category,
      title: input.title.trim(),
      body: input.body.trim(),
      keywords: input.keywords?.trim() || null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setArsenalEntryActive(id: string, active: boolean): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("arsenal_sac_entries").update({ active }).eq("id", id);
  if (error) throw new Error(error.message);
}
