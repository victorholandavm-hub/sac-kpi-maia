-- Classificação manual do time de SAC sobre pedidos em risco de atraso (ver
-- 0043_totvs_deliveries.sql pro dado sincronizado do TOTVS que alimenta a
-- regra automática). Chave natural (pedido, filial_venda) -- igual a
-- totvs_deliveries -- sem FK física pra ela: mesmo princípio de domínios
-- independentes já usado entre as tabelas totvs_* (uma classificação não
-- pode sumir só porque uma página de sync momentaneamente não trouxe aquele
-- pedido).
--
-- entrega_risco_status guarda 1 linha "estado atual" por pedido (nota +
-- data de reavaliação); entrega_risco_events é o histórico append-only de
-- toda mudança, no mesmo padrão de pedido_fornecedor_events/
-- pedido_encomenda_events. actor_role inclui 'sistema' porque o próprio sync
-- do TOTVS grava um evento aqui (reaberto_por_cancelamento) quando detecta
-- que uma carga foi cancelada ou o pedido foi retirado dela -- isso sempre
-- sobrepõe uma classificação manual em snooze, ver src/lib/entregasRisco.ts.

create table if not exists entrega_risco_status (
  id uuid primary key default gen_random_uuid(),
  pedido text not null,
  filial_venda text not null,
  note text,
  reavaliar_em date,
  classified_by_name text not null,
  classified_by_role text not null check (classified_by_role in ('sac', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'entrega_risco_status_pedido_filial_venda_key'
  ) then
    alter table entrega_risco_status add constraint entrega_risco_status_pedido_filial_venda_key unique (pedido, filial_venda);
  end if;
end $$;

create index if not exists entrega_risco_status_reavaliar_em_idx on entrega_risco_status (reavaliar_em);

drop trigger if exists entrega_risco_status_set_updated_at on entrega_risco_status;
create trigger entrega_risco_status_set_updated_at
  before update on entrega_risco_status
  for each row execute function set_updated_at();

create table if not exists entrega_risco_events (
  id uuid primary key default gen_random_uuid(),
  pedido text not null,
  filial_venda text not null,
  actor_name text not null,
  actor_role text not null check (actor_role in ('sac', 'admin', 'sistema')),
  event_type text not null check (event_type in ('classificado', 'reaberto_por_cancelamento')),
  note text,
  reavaliar_em date,
  created_at timestamptz not null default now()
);

create index if not exists entrega_risco_events_pedido_idx on entrega_risco_events (pedido, filial_venda, created_at);

-- RLS: mesmo princípio das tabelas totvs_* -- aplicação usa service-role pra
-- todo acesso real, autorização checada em código (getProfile + requireRole
-- em src/app/assistencia/entregas-risco-actions.ts). RLS é defesa extra.

alter table entrega_risco_status enable row level security;
alter table entrega_risco_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'entrega_risco_status' and policyname = 'entrega_risco_status_select_authenticated'
  ) then
    create policy entrega_risco_status_select_authenticated on entrega_risco_status
      for select to authenticated using (
        exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('sac', 'admin'))
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'entrega_risco_events' and policyname = 'entrega_risco_events_select_authenticated'
  ) then
    create policy entrega_risco_events_select_authenticated on entrega_risco_events
      for select to authenticated using (
        exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('sac', 'admin'))
      );
  end if;
end $$;
