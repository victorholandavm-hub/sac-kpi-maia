-- Suporte a múltiplos produtos por solicitação (ex: montar 2 guarda-roupas + 1 cama
-- no mesmo pedido). Rode depois de 0001_service_requests.sql.

create table if not exists service_request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references service_requests (id) on delete cascade,
  product text not null,
  quantity integer not null default 1 check (quantity > 0),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists service_request_items_request_idx on service_request_items (request_id);

alter table service_request_items enable row level security;

create policy service_request_items_select on service_request_items
  for select to authenticated using (
    exists (
      select 1 from service_requests r
      join profiles p on p.id = auth.uid()
      where r.id = service_request_items.request_id
        and (p.role in ('assistencia', 'admin') or (p.role = 'gerente' and p.store_id = r.store_id))
    )
  );

-- O campo "product" solto em service_requests foi substituído pela tabela acima
-- (uma solicitação agora pode ter vários itens). Sem dados reais até aqui, é seguro remover.
alter table service_requests drop column if exists product;
