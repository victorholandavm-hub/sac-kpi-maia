-- Avaliações do Google por loja (pedido do Victor 18/08/2026): nova aba
-- "Avaliações" no painel de KPIs do SAC, com NPS (já existente, calculado
-- em cima dos chamados do GHL) e a nota/quantidade de avaliações do Google
-- de cada loja, com linha do tempo de evolução. Puxado manualmente uma vez
-- por semana (o Google não permite raspagem automática confiável) --
-- link do Google Maps de cada loja fica salvo em stores.google_maps_url
-- pra não precisar colar de novo toda semana.

alter table stores add column if not exists google_maps_url text;

create table if not exists store_google_reviews (
  id uuid primary key default gen_random_uuid(),
  store_id text not null references stores (id),
  captured_at date not null default current_date,
  rating numeric(2,1) not null check (rating >= 0 and rating <= 5),
  review_count integer not null check (review_count >= 0),
  captured_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  -- Uma leitura por loja por dia -- evita duplicar se eu rodar a mesma
  -- puxada duas vezes no mesmo dia sem querer.
  unique (store_id, captured_at)
);

create index if not exists store_google_reviews_store_idx on store_google_reviews (store_id, captured_at);

alter table store_google_reviews enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'store_google_reviews' and policyname = 'store_google_reviews_select_authenticated'
  ) then
    create policy store_google_reviews_select_authenticated on store_google_reviews for select to authenticated using (true);
  end if;
end $$;
