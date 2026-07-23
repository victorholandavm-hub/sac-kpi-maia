-- Ajustes no fluxo de SAC/troca de produto:
-- 1. Código do produto na solicitação (service_request_items.part_code).
-- 2. Dois tipos novos: entrega_produto (só entrega, sem recolhimento) e
--    envio_peca (independente do módulo de Peças/fornecedores já existente).
-- 3. Sistema de rotas de entrega (Praia/Sul/Centro), configurável por dia da
--    semana, com exceção por solicitação (encaixe fora da rota do dia).
-- 4. Foto do cupom fiscal anexada pela caixa ao criar um pedido de encomenda.

-- 1. Código do produto -----------------------------------------------------------

alter table service_request_items add column if not exists part_code text;

-- 2. Novos tipos de solicitação ----------------------------------------------------

alter table service_requests drop constraint if exists service_requests_type_check;
alter table service_requests add constraint service_requests_type_check
  check (type in ('montagem', 'desmontagem', 'recolhimento', 'troca_peca', 'vistoria', 'notificacao_externa', 'troca_produto', 'entrega_produto', 'envio_peca'));

-- 3. Rotas de entrega ---------------------------------------------------------------

alter table service_requests add column if not exists rota text check (rota in ('praia', 'sul', 'centro'));
alter table service_requests add column if not exists rota_exception_note text;

create table if not exists rota_weekday_config (
  weekday integer primary key check (weekday between 0 and 6), -- 0=domingo ... 6=sábado (JS Date.getDay())
  rota text check (rota in ('praia', 'sul', 'centro'))          -- null = sem rota nesse dia
);

insert into rota_weekday_config (weekday, rota) values
  (0, null),
  (1, 'praia'),
  (2, 'sul'),
  (3, 'centro'),
  (4, 'praia'),
  (5, 'sul'),
  (6, 'centro')
on conflict (weekday) do nothing;

alter table rota_weekday_config enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'rota_weekday_config' and policyname = 'rota_weekday_config_select_authenticated'
  ) then
    create policy rota_weekday_config_select_authenticated on rota_weekday_config for select to authenticated using (true);
  end if;
end $$;

-- 4. Foto do cupom fiscal na encomenda -----------------------------------------------

create table if not exists pedido_encomenda_photos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos_encomenda (id) on delete cascade,
  storage_path text not null,
  uploaded_by text,
  caption text,
  created_at timestamptz not null default now()
);

create index if not exists pedido_encomenda_photos_pedido_idx on pedido_encomenda_photos (pedido_id);

alter table pedido_encomenda_photos enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'pedido_encomenda_photos' and policyname = 'pedido_encomenda_photos_select_authenticated'
  ) then
    create policy pedido_encomenda_photos_select_authenticated on pedido_encomenda_photos for select to authenticated using (true);
  end if;
end $$;
