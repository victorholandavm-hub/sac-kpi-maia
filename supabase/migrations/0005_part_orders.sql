-- Central de peças/fornecedores: rastreia pedidos de peça de reposição junto a
-- fornecedores (planilha "Solicitação de peças"). Uso interno da assistência —
-- lojas não têm acesso a este módulo.

create table if not exists suppliers (
  name text primary key
);

insert into suppliers (name) values
  ('Salleto'), ('Colibri'), ('Valdemóveis'), ('Nesher'), ('Mademarcs'),
  ('Cimol'), ('MX Móveis'), ('Rufato'), ('TCIL'), ('Bertolini')
on conflict (name) do nothing;

create table if not exists part_orders (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid references service_requests (id) on delete set null,
  client_name text,
  client_cpf text,
  client_phone text,
  client_email text,
  product text,
  part_name text not null,
  part_code text,
  color text,
  supplier text references suppliers (name),
  representative text,
  requested_by text,
  status text not null default 'aguardando_peca'
    check (status in ('aguardando_peca', 'peca_recebida', 'enviada_ao_cliente', 'encerrado')),
  part_arrived_at date,
  sent_to_client_at date,
  closed_at date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists part_orders_status_idx on part_orders (status, created_at);
create index if not exists part_orders_service_request_idx on part_orders (service_request_id);

drop trigger if exists part_orders_set_updated_at on part_orders;
create trigger part_orders_set_updated_at
  before update on part_orders
  for each row execute function set_updated_at();

alter table suppliers enable row level security;
alter table part_orders enable row level security;

create policy suppliers_select_authenticated on suppliers
  for select to authenticated using (true);

create policy part_orders_select on part_orders
  for select to authenticated using (
    exists (
      select 1 from profiles p where p.id = auth.uid() and p.role in ('assistencia', 'admin')
    )
  );
