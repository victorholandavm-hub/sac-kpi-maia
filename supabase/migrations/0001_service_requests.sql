-- Módulo de Solicitações de Assistência (montagem/desmontagem/recolhimento/notificação externa)
-- Rode este arquivo no SQL editor do projeto Supabase da Lojas Maia (ou via `supabase db push`).

create extension if not exists pgcrypto;

-- 1. Lojas -----------------------------------------------------------------

create table if not exists stores (
  id text primary key,
  name text not null
);

insert into stores (id, name) values
  ('201', 'Maia Bayeux'),
  ('202', 'Maia Santa Rita'),
  ('203', 'Líder Santo Elias'),
  ('204', 'Líder Tambaú'),
  ('205', 'Líder 1 Mangabeira'),
  ('206', 'Maia 2 Mangabeira'),
  ('207', 'Maia 3 Mangabeira'),
  ('208', 'GL'),
  ('209', 'Pluma'),
  ('210', 'Maia Cabedelo'),
  ('211', 'Maia Barão do T.'),
  ('212', 'Maia Shopping M'),
  ('213', 'Maia CD'),
  ('214', 'Maia Mamanguape'),
  ('215', 'Líder Manaíra'),
  ('216', 'Maia Campina Grande')
on conflict (id) do update set name = excluded.name;

-- 2. Perfis (1:1 com auth.users) --------------------------------------------

create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('gerente', 'assistencia', 'admin')),
  store_id text references stores (id),
  created_at timestamptz not null default now(),
  constraint gerente_requires_store check (role <> 'gerente' or store_id is not null)
);

-- 3. Solicitações -------------------------------------------------------------

create table if not exists service_requests (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('montagem', 'desmontagem', 'recolhimento', 'notificacao_externa')),
  status text not null default 'aberta'
    check (status in ('aberta', 'em_contato', 'em_andamento', 'concluida', 'cancelada')),
  store_id text not null references stores (id),
  requested_by uuid not null references profiles (id),
  assigned_to uuid references profiles (id),
  order_code text,
  client_name text,
  client_cpf text,
  client_phone text,
  client_address text,
  client_neighborhood text,
  product text,
  reason text,
  restriction_note text,
  notes text,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists service_requests_store_status_idx on service_requests (store_id, status);
create index if not exists service_requests_status_created_idx on service_requests (status, created_at);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists service_requests_set_updated_at on service_requests;
create trigger service_requests_set_updated_at
  before update on service_requests
  for each row execute function set_updated_at();

-- 4. Timeline / auditoria -----------------------------------------------------

create table if not exists service_request_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references service_requests (id) on delete cascade,
  actor_id uuid references profiles (id),
  event_type text not null check (event_type in ('created', 'status_changed', 'assigned', 'note_added')),
  from_status text,
  to_status text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists service_request_events_request_idx on service_request_events (request_id, created_at);

-- 5. RLS ----------------------------------------------------------------------
-- Aplicação usa o client service-role (getSupabaseAdmin) para todo acesso real,
-- com autorização checada em código (ver src/lib/dal.ts). RLS aqui é só uma
-- camada extra de defesa caso a anon key seja usada diretamente.

alter table stores enable row level security;
alter table profiles enable row level security;
alter table service_requests enable row level security;
alter table service_request_events enable row level security;

create policy stores_select_authenticated on stores
  for select to authenticated using (true);

create policy profiles_select_own on profiles
  for select to authenticated using (id = auth.uid());

create policy service_requests_select on service_requests
  for select to authenticated using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and (p.role in ('assistencia', 'admin') or (p.role = 'gerente' and p.store_id = service_requests.store_id))
    )
  );

create policy service_requests_insert on service_requests
  for insert to authenticated with check (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'gerente' and p.store_id = service_requests.store_id
    )
  );

create policy service_requests_update on service_requests
  for update to authenticated using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role in ('assistencia', 'admin')
    )
  );

create policy service_request_events_select on service_request_events
  for select to authenticated using (
    exists (
      select 1 from service_requests r
      join profiles p on p.id = auth.uid()
      where r.id = service_request_events.request_id
        and (p.role in ('assistencia', 'admin') or (p.role = 'gerente' and p.store_id = r.store_id))
    )
  );
