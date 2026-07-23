-- Reorganiza a auth do módulo de Encomendas (0027_pedidos_encomenda.sql):
--
-- 1. Quem lança o pedido na loja é a CAIXA, não o gerente (gerente cuida de
--    prazo de assistência, papel diferente). Caixa usa PIN único por loja
--    (não por pessoa) -- reaproveita o precedente que já existiu neste
--    projeto antes de 0017->0023 trocar pra PIN por gerente (aquela troca
--    foi só porque assistência precisa saber QUEM negociou prazo; encomenda
--    não tem essa exigência).
-- 2. CD e Fábrica deixam de ser contas Supabase Auth (profiles.role) e viram
--    login por nome+PIN, igual assemblers/drivers -- não fazem parte da
--    equipe de assistência, não deveriam compartilhar login com ela.

-- 1. Reverte profiles.role -----------------------------------------------------

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'profiles_role_check') then
    alter table profiles drop constraint profiles_role_check;
  end if;
  alter table profiles add constraint profiles_role_check
    check (role in ('assistencia', 'admin', 'sac'));
end $$;

-- 2. Corrige o check de pedido_encomenda_events.actor_role ----------------------
-- Faltava 'assistencia' -- uma ação feita por alguém com profiles.role =
-- 'assistencia' quebraria o insert do evento.

alter table pedido_encomenda_events drop constraint if exists pedido_encomenda_events_actor_role_check;
alter table pedido_encomenda_events add constraint pedido_encomenda_events_actor_role_check
  check (actor_role in ('loja', 'cd', 'fabrica', 'admin', 'assistencia'));

-- 3. Novas tabelas de PIN -------------------------------------------------------

create table if not exists cd_operadores (
  name text primary key,
  pin_hash text,
  failed_pin_attempts integer not null default 0,
  pin_locked_until timestamptz
);

create table if not exists fabrica_operadores (
  name text primary key,
  pin_hash text,
  failed_pin_attempts integer not null default 0,
  pin_locked_until timestamptz
);

create table if not exists encomenda_caixa_pins (
  store_id text primary key references stores (id) on delete cascade,
  pin_hash text,
  failed_pin_attempts integer not null default 0,
  pin_locked_until timestamptz
);

alter table cd_operadores enable row level security;
alter table fabrica_operadores enable row level security;
alter table encomenda_caixa_pins enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'cd_operadores' and policyname = 'cd_operadores_select_authenticated'
  ) then
    create policy cd_operadores_select_authenticated on cd_operadores for select to authenticated using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'fabrica_operadores' and policyname = 'fabrica_operadores_select_authenticated'
  ) then
    create policy fabrica_operadores_select_authenticated on fabrica_operadores for select to authenticated using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'encomenda_caixa_pins' and policyname = 'encomenda_caixa_pins_select_authenticated'
  ) then
    create policy encomenda_caixa_pins_select_authenticated on encomenda_caixa_pins for select to authenticated using (true);
  end if;
end $$;
