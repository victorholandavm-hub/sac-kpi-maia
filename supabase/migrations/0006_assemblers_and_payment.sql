-- Lista fixa de montadores (mesmo padrão de suppliers/stores) e campos de
-- valor/pagamento por item de solicitação (planilha "Montagens Lojas.Clientes").

create table if not exists assemblers (
  name text primary key
);

insert into assemblers (name) values
  ('Paulo'), ('Junior'), ('Eduardo'), ('Janailson'), ('Gabriel')
on conflict (name) do nothing;

alter table service_requests drop constraint if exists service_requests_assembler_name_fkey;
alter table service_requests add constraint service_requests_assembler_name_fkey
  foreign key (assembler_name) references assemblers (name);

alter table service_request_items add column if not exists unit_value numeric(10, 2);
alter table service_request_items add column if not exists payment_released boolean not null default false;
alter table service_request_items add column if not exists payment_released_at timestamptz;

alter table assemblers enable row level security;

create policy assemblers_select_authenticated on assemblers
  for select to authenticated using (true);
