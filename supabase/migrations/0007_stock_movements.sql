-- Registro de movimentação de estoque da assistência (planilha "Estoque da
-- Assistência/Retirados CD": abas Retirados, Devolvidos, Reparados por Mael).
-- As 3 abas viram um só tipo de movimento (movement_type), já que têm a mesma
-- forma geral de registro.

create table if not exists stock_movements (
  id uuid primary key default gen_random_uuid(),
  movement_type text not null check (movement_type in ('retirado', 'devolvido', 'reparado')),
  code text,
  product text not null,
  factory text references suppliers (name),
  client_name text,
  volume text,
  responsible text,
  movement_date date,
  logged_date date,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists stock_movements_type_idx on stock_movements (movement_type, created_at);

alter table stock_movements enable row level security;

create policy stock_movements_select on stock_movements
  for select to authenticated using (
    exists (
      select 1 from profiles p where p.id = auth.uid() and p.role in ('assistencia', 'admin')
    )
  );
