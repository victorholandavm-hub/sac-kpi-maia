-- Módulo de Pedidos a Fornecedores Externos: separado do módulo de Encomendas
-- (pedidos_encomenda), que é loja pedindo produto pra nossa fábrica (AIAM)
-- expedir via CD. Aqui é o CD comprando reposição de estoque direto de
-- fábricas/fornecedores que não são nossos (Nesher, Probel, Kappesberg,
-- Tuboarte etc.) -- sem loja envolvida e sem etapa de produção. Reaproveita o
-- catálogo de fornecedores já existente (suppliers, criado em 0005_part_orders.sql).

create sequence if not exists pedido_fornecedor_seq;

create table if not exists pedidos_fornecedor (
  id uuid primary key default gen_random_uuid(),
  pedido_number integer not null default nextval('pedido_fornecedor_seq'),
  fornecedor text not null references suppliers (name),
  requested_by_name text not null,
  status text not null default 'pedido_feito'
    check (status in ('pedido_feito', 'recebido', 'cancelado')),
  expected_at date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'pedidos_fornecedor_pedido_number_key'
  ) then
    alter table pedidos_fornecedor add constraint pedidos_fornecedor_pedido_number_key unique (pedido_number);
  end if;
end $$;

create index if not exists pedidos_fornecedor_status_idx on pedidos_fornecedor (status, created_at);
create index if not exists pedidos_fornecedor_fornecedor_idx on pedidos_fornecedor (fornecedor);

drop trigger if exists pedidos_fornecedor_set_updated_at on pedidos_fornecedor;
create trigger pedidos_fornecedor_set_updated_at
  before update on pedidos_fornecedor
  for each row execute function set_updated_at();

create table if not exists pedido_fornecedor_itens (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos_fornecedor (id) on delete cascade,
  produto_descricao text not null,
  quantidade integer not null check (quantidade > 0)
);

create index if not exists pedido_fornecedor_itens_pedido_idx on pedido_fornecedor_itens (pedido_id);

create table if not exists pedido_fornecedor_events (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos_fornecedor (id) on delete cascade,
  actor_name text not null,
  actor_role text not null check (actor_role in ('cd', 'admin', 'assistencia')),
  event_type text not null check (event_type in ('created', 'status_changed', 'note_added', 'expected_at_changed')),
  from_status text,
  to_status text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists pedido_fornecedor_events_pedido_idx on pedido_fornecedor_events (pedido_id, created_at);

-- RLS: aplicação usa o client service-role (getSupabaseAdmin) pra todo acesso
-- real, com autorização checada em código (src/lib/fornecedorPedidoAuth.ts).
-- RLS aqui é só uma camada extra de defesa caso a anon key seja usada direto.

alter table pedidos_fornecedor enable row level security;
alter table pedido_fornecedor_itens enable row level security;
alter table pedido_fornecedor_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'pedidos_fornecedor' and policyname = 'pedidos_fornecedor_select_authenticated'
  ) then
    create policy pedidos_fornecedor_select_authenticated on pedidos_fornecedor
      for select to authenticated using (
        exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('assistencia', 'admin'))
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'pedido_fornecedor_itens' and policyname = 'pedido_fornecedor_itens_select_authenticated'
  ) then
    create policy pedido_fornecedor_itens_select_authenticated on pedido_fornecedor_itens
      for select to authenticated using (
        exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('assistencia', 'admin'))
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'pedido_fornecedor_events' and policyname = 'pedido_fornecedor_events_select_authenticated'
  ) then
    create policy pedido_fornecedor_events_select_authenticated on pedido_fornecedor_events
      for select to authenticated using (
        exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('assistencia', 'admin'))
      );
  end if;
end $$;

-- Realtime -----------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pedidos_fornecedor'
  ) then
    alter publication supabase_realtime add table pedidos_fornecedor;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pedido_fornecedor_events'
  ) then
    alter publication supabase_realtime add table pedido_fornecedor_events;
  end if;
end $$;
