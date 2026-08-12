-- Saldo de estoque do CD (WSStock do Protheus, documentado em totvs.md) --
-- alimenta o indicador de "dias de cobertura"/ruptura em "Vendas por
-- produto" (src/lib/vendasProduto.ts). current_balance/reserved_qty são a
-- SOMA de stores[] (saldo por filial dentro do mesmo armazém 75 -- ver
-- comentário em src/lib/totvsSync.ts), não estoque físico por loja
-- separada. Mesmo padrão de 0039_totvs_sync.sql (tabelas totvs_*).

create table if not exists totvs_stock (
  id uuid primary key default gen_random_uuid(),
  product_code text not null,
  description text,
  manufacturer text,
  unit_cost numeric(14, 2),
  current_balance numeric(14, 2) not null default 0,
  reserved_qty numeric(14, 2) not null default 0,
  purchase_order_balance numeric(14, 2),
  estimated_arrival_date date,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'totvs_stock_product_code_key'
  ) then
    alter table totvs_stock add constraint totvs_stock_product_code_key unique (product_code);
  end if;
end $$;

drop trigger if exists totvs_stock_set_updated_at on totvs_stock;
create trigger totvs_stock_set_updated_at
  before update on totvs_stock
  for each row execute function set_updated_at();

alter table totvs_stock enable row level security;

-- Mesma camada extra de defesa de 0073_vendas_produto_rls.sql -- a
-- autorização real é checada em código (requireVendasActor), essa policy
-- só cobre o caminho admin via Supabase Auth.
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'totvs_stock' and policyname = 'totvs_stock_select_admin'
  ) then
    create policy totvs_stock_select_admin on totvs_stock
      for select to authenticated using (
        exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
      );
  end if;
end $$;
