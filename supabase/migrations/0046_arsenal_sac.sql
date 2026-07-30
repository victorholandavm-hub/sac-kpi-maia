-- Base de conhecimento "Arsenal do SAC" -- consulta rápida, por texto livre,
-- de quem acionar por assunto, contato de fornecedores/fabricantes, prazos
-- de garantia e artigos do CDC aplicados ao atendimento. Cada linha é uma
-- entrada de referência autocontida (SEM workflow de status/timeline -- não
-- é um processo com etapas, é conteúdo pra consulta). Conteúdo inicial é
-- povoado por scripts/seed-arsenal.ts (migrations aqui são só schema, nunca
-- dado de negócio/conteúdo).
--
-- Busca por texto livre usa full-text search nativo do Postgres
-- (tsvector/websearch_to_tsquery, config 'portuguese') em vez de ilike: o
-- requisito é "aparecer tudo que tiver ligação com aquilo", que pede
-- relevância/ranking sobre título+palavras-chave+corpo, não só substring.
-- Esta é a primeira tabela do projeto usando full-text search (sem
-- precedente em outras migrations -- registrando aqui pra quem ler depois).
--
-- Acento-insensível é importante em português (ex. "colchão" x "colchao"
-- digitado sem acento, sem tempo de corrigir) -- usa a extensão unaccent.
-- A função unaccent() built-in é STABLE, não IMMUTABLE, então não pode ir
-- direto numa generated column nem num índice funcional. unaccent_immutable()
-- abaixo é o wrapper padrão da comunidade Postgres pra esse caso: IMMUTABLE,
-- fixando o dicionário 'unaccent' explicitamente. Usado tanto na coluna
-- gerada quanto (dentro de search_arsenal_sac) na normalização do termo
-- buscado -- os dois lados da comparação precisam do mesmo tratamento.

create extension if not exists unaccent;

create or replace function unaccent_immutable(text)
returns text as $$
  select unaccent('unaccent', $1);
$$ language sql immutable strict parallel safe;

create table if not exists arsenal_sac_entries (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('contatos_internos', 'fornecedores', 'processos', 'garantias', 'cdc')),
  slug text not null,
  title text not null,
  body text not null,
  keywords text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Peso A pra título+palavras-chave (o que a pessoa mais provavelmente
  -- digitou), peso B pro corpo -- pra um match no título rankear acima de
  -- um match perdido no meio de um parágrafo de garantia.
  search_vector tsvector generated always as (
    setweight(to_tsvector('portuguese', unaccent_immutable(title)), 'A') ||
    setweight(to_tsvector('portuguese', unaccent_immutable(coalesce(keywords, ''))), 'A') ||
    setweight(to_tsvector('portuguese', unaccent_immutable(body)), 'B')
  ) stored
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'arsenal_sac_entries_slug_key'
  ) then
    alter table arsenal_sac_entries add constraint arsenal_sac_entries_slug_key unique (slug);
  end if;
end $$;

create index if not exists arsenal_sac_entries_search_vector_idx on arsenal_sac_entries using gin (search_vector);
create index if not exists arsenal_sac_entries_category_idx on arsenal_sac_entries (category);

drop trigger if exists arsenal_sac_entries_set_updated_at on arsenal_sac_entries;
create trigger arsenal_sac_entries_set_updated_at
  before update on arsenal_sac_entries
  for each row execute function set_updated_at();

-- Busca via RPC em vez de .textSearch() do supabase-js: precisamos aplicar
-- unaccent_immutable() no termo digitado também (senão "colchao" sem acento
-- não bate com "colchão" no texto), e .textSearch() não dá esse gancho --
-- ele só monta a comparação direto contra a coluna com o termo cru.
-- websearch_to_tsquery entende sintaxe "de usuário" (aspas, "-" pra excluir
-- termo etc.) sem quebrar com caracteres soltos, diferente de to_tsquery.
-- Só entre entradas ativas -- é a ferramenta de consulta do dia a dia, não
-- de administração (ver listagem "mostrar inativas" em arsenalSac.ts pro
-- caminho de achar uma entrada desativada).
create or replace function search_arsenal_sac(search_query text, category_filter text default null)
returns table (
  id uuid,
  category text,
  slug text,
  title text,
  body text,
  keywords text,
  active boolean,
  created_at timestamptz,
  updated_at timestamptz,
  rank real
)
language sql stable as $$
  select
    e.id, e.category, e.slug, e.title, e.body, e.keywords, e.active, e.created_at, e.updated_at,
    ts_rank(e.search_vector, websearch_to_tsquery('portuguese', unaccent_immutable(search_query))) as rank
  from arsenal_sac_entries e
  where e.active = true
    and (category_filter is null or e.category = category_filter)
    and e.search_vector @@ websearch_to_tsquery('portuguese', unaccent_immutable(search_query))
  order by rank desc, e.title asc;
$$;

-- RLS: leitura pra sac/admin (mesmo padrão de entrega_risco_status); sem
-- policy de insert/update/delete -- toda escrita passa por getSupabaseAdmin()
-- com autorização em código (só admin, ver arsenal-actions.ts). RLS aqui é
-- defesa extra, não o mecanismo real de autorização.

alter table arsenal_sac_entries enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'arsenal_sac_entries' and policyname = 'arsenal_sac_entries_select_authenticated'
  ) then
    create policy arsenal_sac_entries_select_authenticated on arsenal_sac_entries
      for select to authenticated using (
        exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('sac', 'admin'))
      );
  end if;
end $$;
