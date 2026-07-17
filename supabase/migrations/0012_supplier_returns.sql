-- Reconciliação financeira com fornecedor: itens defeituosos devolvidos pra
-- conserto/reembolso — fluxo distinto de "pedido de peça" (que é receber peça
-- do fornecedor, não devolver). Cobre as abas "Remessa para conserto" e
-- "Compartivos" da planilha de peças (valor em devolução, faturado,
-- reembolsado, pendente, por fornecedor).

create table if not exists supplier_returns (
  id uuid primary key default gen_random_uuid(),
  supplier text references suppliers (name),
  product text,
  part_name text not null,
  invoice_number text,
  invoice_value numeric(10, 2),
  sent_at date,
  expected_return_at date,
  received_at date,
  reimbursed_value numeric(10, 2),
  status text not null default 'aguardando_envio'
    check (status in ('aguardando_envio', 'enviado', 'recebido', 'reembolsado', 'finalizado')),
  requested_by text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists supplier_returns_status_idx on supplier_returns (status, created_at);
create index if not exists supplier_returns_supplier_idx on supplier_returns (supplier);

drop trigger if exists supplier_returns_set_updated_at on supplier_returns;
create trigger supplier_returns_set_updated_at
  before update on supplier_returns
  for each row execute function set_updated_at();

alter table supplier_returns enable row level security;

create policy supplier_returns_select on supplier_returns
  for select to authenticated using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('assistencia', 'admin'))
  );
