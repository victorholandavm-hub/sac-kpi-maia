-- Módulo de Controle de Encomendas (loja pede -> fábrica produz -> CD expede).
-- Substitui o controle manual feito na planilha "ACOMPANHAMENTO PEDIDO X
-- ASSISTÊNCIAS.xlsx" (aba ENCOMENDAS): loja tirava foto da nota e mandava num
-- grupo do WhatsApp, sem visibilidade em tempo real entre loja/CD/fábrica.
--
-- Reaproveita a auth de gerente de loja já existente (getLojaGerenteSession /
-- getGerenteStoreIds) e a tabela `stores` já normalizada. CD e fábrica são
-- poucos usuários internos, então seguem o mesmo padrão de "sac" (Supabase
-- Auth + profiles.role), não o padrão de PIN usado por montador/motorista.

-- 1. Papéis novos em profiles --------------------------------------------------

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'profiles_role_check') then
    alter table profiles drop constraint profiles_role_check;
  end if;
  alter table profiles add constraint profiles_role_check
    check (role in ('assistencia', 'admin', 'sac', 'cd', 'fabrica'));
end $$;

-- 2. Catálogo de produtos -------------------------------------------------------

create table if not exists produtos_encomenda (
  id uuid primary key default gen_random_uuid(),
  descricao text not null unique,
  categoria text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- 3. Pedidos ---------------------------------------------------------------------

create sequence if not exists pedido_encomenda_seq;

create table if not exists pedidos_encomenda (
  id uuid primary key default gen_random_uuid(),
  pedido_number integer not null default nextval('pedido_encomenda_seq'),
  store_id text not null references stores (id),
  status text not null default 'solicitado'
    check (status in ('solicitado', 'em_producao', 'pronto_para_expedicao', 'em_carga', 'faturado', 'entregue', 'cancelado')),
  carga text,
  nf_e text,
  requested_by_name text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'pedidos_encomenda_pedido_number_key'
  ) then
    alter table pedidos_encomenda add constraint pedidos_encomenda_pedido_number_key unique (pedido_number);
  end if;
end $$;

create index if not exists pedidos_encomenda_store_status_idx on pedidos_encomenda (store_id, status);
create index if not exists pedidos_encomenda_status_created_idx on pedidos_encomenda (status, created_at);

-- Reaproveita a função set_updated_at criada em 0001_service_requests.sql.
drop trigger if exists pedidos_encomenda_set_updated_at on pedidos_encomenda;
create trigger pedidos_encomenda_set_updated_at
  before update on pedidos_encomenda
  for each row execute function set_updated_at();

-- 4. Itens do pedido ---------------------------------------------------------------

create table if not exists pedido_encomenda_itens (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos_encomenda (id) on delete cascade,
  produto_id uuid not null references produtos_encomenda (id),
  quantidade integer not null check (quantidade > 0)
);

create index if not exists pedido_encomenda_itens_pedido_idx on pedido_encomenda_itens (pedido_id);

-- 5. Timeline / auditoria -----------------------------------------------------------

create table if not exists pedido_encomenda_events (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos_encomenda (id) on delete cascade,
  actor_name text not null,
  actor_role text not null check (actor_role in ('loja', 'cd', 'fabrica', 'admin')),
  event_type text not null check (event_type in ('created', 'status_changed', 'item_added', 'carga_informada', 'nf_e_informada', 'note_added')),
  from_status text,
  to_status text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists pedido_encomenda_events_pedido_idx on pedido_encomenda_events (pedido_id, created_at);

-- 6. RLS ------------------------------------------------------------------------------
-- Aplicação usa o client service-role (getSupabaseAdmin) pra todo acesso real,
-- com autorização checada em código (src/lib/dal.ts). RLS aqui é só uma
-- camada extra de defesa caso a anon key seja usada diretamente.

alter table produtos_encomenda enable row level security;
alter table pedidos_encomenda enable row level security;
alter table pedido_encomenda_itens enable row level security;
alter table pedido_encomenda_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'produtos_encomenda' and policyname = 'produtos_encomenda_select_authenticated'
  ) then
    create policy produtos_encomenda_select_authenticated on produtos_encomenda
      for select to authenticated using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'pedidos_encomenda' and policyname = 'pedidos_encomenda_select_authenticated'
  ) then
    create policy pedidos_encomenda_select_authenticated on pedidos_encomenda
      for select to authenticated using (
        exists (
          select 1 from profiles p
          where p.id = auth.uid() and p.role in ('assistencia', 'admin', 'cd', 'fabrica')
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'pedido_encomenda_itens' and policyname = 'pedido_encomenda_itens_select_authenticated'
  ) then
    create policy pedido_encomenda_itens_select_authenticated on pedido_encomenda_itens
      for select to authenticated using (
        exists (
          select 1 from profiles p
          where p.id = auth.uid() and p.role in ('assistencia', 'admin', 'cd', 'fabrica')
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'pedido_encomenda_events' and policyname = 'pedido_encomenda_events_select_authenticated'
  ) then
    create policy pedido_encomenda_events_select_authenticated on pedido_encomenda_events
      for select to authenticated using (
        exists (
          select 1 from profiles p
          where p.id = auth.uid() and p.role in ('assistencia', 'admin', 'cd', 'fabrica')
        )
      );
  end if;
end $$;

-- 7. Realtime -------------------------------------------------------------------------
-- Mesmo mecanismo usado por service_requests/service_request_events (ver
-- 0013_realtime_service_requests.sql) -- alimenta o RealtimeQueueRefresher.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pedidos_encomenda'
  ) then
    alter publication supabase_realtime add table pedidos_encomenda;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pedido_encomenda_events'
  ) then
    alter publication supabase_realtime add table pedido_encomenda_events;
  end if;
end $$;
