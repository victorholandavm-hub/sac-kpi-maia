-- Número de chamado único e sequencial, compartilhado entre solicitações de
-- assistência (montagem/desmontagem/recolhimento/troca de peça/vistoria/
-- notificação externa) e pedidos de peça — pra ter um único número simples
-- (ex: "Chamado #1042") pra identificar qualquer chamado por telefone/
-- WhatsApp, em vez do UUID interno. Backfill em ordem cronológica: quem foi
-- criado primeiro recebe o menor número.

create sequence if not exists chamado_number_seq;

alter table service_requests add column if not exists ticket_number integer;
alter table part_orders add column if not exists ticket_number integer;

do $$
declare
  r record;
begin
  for r in (
    select id, 'service_requests' as tbl, created_at from service_requests where ticket_number is null
    union all
    select id, 'part_orders' as tbl, created_at from part_orders where ticket_number is null
    order by created_at
  ) loop
    if r.tbl = 'service_requests' then
      update service_requests set ticket_number = nextval('chamado_number_seq') where id = r.id;
    else
      update part_orders set ticket_number = nextval('chamado_number_seq') where id = r.id;
    end if;
  end loop;
end $$;

alter table service_requests alter column ticket_number set not null;
alter table service_requests alter column ticket_number set default nextval('chamado_number_seq');
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'service_requests_ticket_number_key'
  ) then
    alter table service_requests add constraint service_requests_ticket_number_key unique (ticket_number);
  end if;
end $$;

alter table part_orders alter column ticket_number set not null;
alter table part_orders alter column ticket_number set default nextval('chamado_number_seq');
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'part_orders_ticket_number_key'
  ) then
    alter table part_orders add constraint part_orders_ticket_number_key unique (ticket_number);
  end if;
end $$;
