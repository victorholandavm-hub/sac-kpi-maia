-- Ingestão do ERP Protheus (TOTVS) via src/app/api/totvs-sync/route.ts: clientes
-- (WSClient) e pedidos/NFs (WSOrders), documentados em totvs*.md na raiz do
-- projeto. totvs_orders.client_id não tem FK pra totvs_clientes de propósito
-- -- os dois syncs rodam de forma independente e um não pode falhar por causa
-- do outro. totvs_sync_state guarda o cursor de paginação/data pra cada sync
-- ser retomável entre execuções do cron (sem depender de app_config, que é
-- usada só pelo sync do GHL e não tem migration própria neste repo).

create table if not exists totvs_clientes (
  id uuid primary key default gen_random_uuid(),
  protheus_code text not null,
  cpf_cnpj text not null,
  name text not null,
  status text not null check (status in ('nunca comprou', 'ativo', 'inativo')),
  last_purchase_date date,
  days_without_buying integer,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'totvs_clientes_protheus_code_key'
  ) then
    alter table totvs_clientes add constraint totvs_clientes_protheus_code_key unique (protheus_code);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'totvs_clientes_cpf_cnpj_key'
  ) then
    alter table totvs_clientes add constraint totvs_clientes_cpf_cnpj_key unique (cpf_cnpj);
  end if;
end $$;

create index if not exists totvs_clientes_status_idx on totvs_clientes (status);

drop trigger if exists totvs_clientes_set_updated_at on totvs_clientes;
create trigger totvs_clientes_set_updated_at
  before update on totvs_clientes
  for each row execute function set_updated_at();

create table if not exists totvs_orders (
  id uuid primary key default gen_random_uuid(),
  invoice text not null,
  serie text not null,
  branch text not null,
  issue_date date not null,
  payment_method text,
  invoice_total numeric(14, 2) not null default 0,
  type text not null check (type in ('Venda', 'Devolucao')),
  nfe_key text,
  seller_id text,
  seller_name text,
  client_id text,
  client_cpf_cnpj text,
  client_name text,
  client_loja text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'totvs_orders_invoice_serie_branch_key'
  ) then
    alter table totvs_orders add constraint totvs_orders_invoice_serie_branch_key unique (invoice, serie, branch);
  end if;
end $$;

create index if not exists totvs_orders_issue_date_idx on totvs_orders (issue_date);
create index if not exists totvs_orders_client_id_idx on totvs_orders (client_id);
create index if not exists totvs_orders_client_cpf_cnpj_idx on totvs_orders (client_cpf_cnpj);

drop trigger if exists totvs_orders_set_updated_at on totvs_orders;
create trigger totvs_orders_set_updated_at
  before update on totvs_orders
  for each row execute function set_updated_at();

create table if not exists totvs_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references totvs_orders (id) on delete cascade,
  item_number text not null,
  product text,
  description text,
  manufacturer text,
  unit text,
  quantity numeric(14, 4) not null default 0,
  unit_price numeric(14, 2),
  sale_price numeric(14, 2),
  total numeric(14, 2) not null default 0,
  discount numeric(14, 2),
  tes text,
  cfop text
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'totvs_order_items_order_id_item_number_key'
  ) then
    alter table totvs_order_items add constraint totvs_order_items_order_id_item_number_key unique (order_id, item_number);
  end if;
end $$;

create index if not exists totvs_order_items_order_id_idx on totvs_order_items (order_id);

create table if not exists totvs_sync_state (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

drop trigger if exists totvs_sync_state_set_updated_at on totvs_sync_state;
create trigger totvs_sync_state_set_updated_at
  before update on totvs_sync_state
  for each row execute function set_updated_at();

-- RLS: aplicação usa o client service-role (getSupabaseAdmin) tanto pro sync
-- quanto pra futura leitura via lib/kpi -- sem policy pra authenticated por
-- enquanto não existe UI lendo essas tabelas diretamente. RLS aqui é só uma
-- camada extra de defesa caso a anon key seja usada direto.

alter table totvs_clientes enable row level security;
alter table totvs_orders enable row level security;
alter table totvs_order_items enable row level security;
alter table totvs_sync_state enable row level security;
