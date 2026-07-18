-- Estende o número de chamado compartilhado (mesma sequência de
-- service_requests/part_orders) pra remessas de fornecedor também, por
-- consistência — a tabela está vazia agora (dados históricos zerados), então
-- não precisa de backfill.

alter table supplier_returns add column if not exists ticket_number integer;
alter table supplier_returns alter column ticket_number set default nextval('chamado_number_seq');

update supplier_returns set ticket_number = nextval('chamado_number_seq') where ticket_number is null;

alter table supplier_returns alter column ticket_number set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'supplier_returns_ticket_number_key'
  ) then
    alter table supplier_returns add constraint supplier_returns_ticket_number_key unique (ticket_number);
  end if;
end $$;
