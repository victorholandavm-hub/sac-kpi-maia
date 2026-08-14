-- Destaque visual pra entrada do Arsenal do SAC -- pedido do Victor pra
-- deixar as regras rígidas/sem exceção (ex.: "nunca deixar dois produtos na
-- casa do cliente") visualmente óbvias em vez de se misturarem no meio de
-- texto corrido. 'normal' é o default (maioria das entradas, sem destaque);
-- 'regra_ouro' marca um princípio a seguir sempre; 'atencao' marca um risco
-- concreto (algo que NÃO pode acontecer).
alter table arsenal_sac_entries
  add column if not exists highlight_type text not null default 'normal'
    check (highlight_type in ('normal', 'regra_ouro', 'atencao'));

-- search_arsenal_sac precisa devolver a coluna nova -- create or replace não
-- permite mudar a lista de colunas de retorno de uma function existente,
-- então precisa dropar antes (mesma assinatura de parâmetros de
-- 0046_arsenal_sac.sql).
drop function if exists search_arsenal_sac(text, text);

create function search_arsenal_sac(search_query text, category_filter text default null)
returns table (
  id uuid,
  category text,
  slug text,
  title text,
  body text,
  keywords text,
  active boolean,
  highlight_type text,
  created_at timestamptz,
  updated_at timestamptz,
  rank real
)
language sql stable as $$
  select
    e.id, e.category, e.slug, e.title, e.body, e.keywords, e.active, e.highlight_type, e.created_at, e.updated_at,
    ts_rank(e.search_vector, websearch_to_tsquery('portuguese', unaccent_immutable(search_query))) as rank
  from arsenal_sac_entries e
  where e.active = true
    and (category_filter is null or e.category = category_filter)
    and e.search_vector @@ websearch_to_tsquery('portuguese', unaccent_immutable(search_query))
  order by rank desc, e.title asc;
$$;
