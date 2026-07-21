-- Motoristas (portal próprio, login por nome+PIN igual ao montador) e o
-- novo tipo de chamado "troca_produto": SAC recolhe o produto errado/
-- avariado na casa do cliente e entrega o correto — diferente de
-- "troca_peca" (peça avulsa, resolvida pela assistência/montador) e de
-- "recolhimento" (só recolhe, não tem entrega associada).

create table if not exists drivers (
  name text primary key,
  pin_hash text,
  failed_pin_attempts integer not null default 0,
  pin_locked_until timestamptz
);

alter table drivers enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'drivers' and policyname = 'drivers_select_authenticated'
  ) then
    create policy drivers_select_authenticated on drivers for select to authenticated using (true);
  end if;
end $$;

alter table service_requests add column if not exists driver_name text;
alter table service_requests drop constraint if exists service_requests_driver_name_fkey;
alter table service_requests add constraint service_requests_driver_name_fkey
  foreign key (driver_name) references drivers (name);

-- Rastreia separado do status geral: às vezes a entrega do produto correto
-- acontece numa visita e o recolhimento do errado/avariado só depois (ou
-- vice-versa) — sem isso não dá pra saber se ainda tem alguma coisa errada
-- na casa do cliente esperando ser buscada.
alter table service_requests add column if not exists pickup_completed boolean not null default false;

alter table service_requests drop constraint if exists service_requests_type_check;
alter table service_requests add constraint service_requests_type_check
  check (type in ('montagem', 'desmontagem', 'recolhimento', 'troca_peca', 'vistoria', 'notificacao_externa', 'troca_produto'));

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'profiles_role_check') then
    alter table profiles drop constraint profiles_role_check;
  end if;
  alter table profiles add constraint profiles_role_check check (role in ('assistencia', 'admin', 'sac'));
end $$;
