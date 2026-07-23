-- Vendedor também lança encomenda (além de caixa e gerente) -- ver
-- src/lib/encomendaRequester.ts. Vendedor é papel novo: PIN individual por
-- pessoa (como gerente), mas preso a UMA loja só (não N:N -- vendedor
-- trabalha num lugar só, diferente de gerente que pode cuidar de várias).

create table if not exists vendedores (
  name text primary key,
  store_id text not null references stores (id) on delete cascade,
  pin_hash text,
  failed_pin_attempts integer not null default 0,
  pin_locked_until timestamptz
);

alter table vendedores enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'vendedores' and policyname = 'vendedores_select_authenticated'
  ) then
    create policy vendedores_select_authenticated on vendedores for select to authenticated using (true);
  end if;
end $$;

-- Campo opcional "pra qual vendedor é essa encomenda" -- não é FK, mesmo
-- padrão de driver_name no formulário de SAC (texto livre + datalist).
alter table pedidos_encomenda add column if not exists vendedor_name text;
