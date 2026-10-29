-- Cargas do Odoo gravadas no formato do Protheus (odooCargasComoProtheus.ts,
-- Victor 29/10/2026): a tentativa de cada pedido é a ordem das cargas por
-- onde ele passou (dia da carga, depois o romaneio). Chamada no fim de cada
-- leitura da expedição.
create or replace function renumerar_tentativas_odoo() returns integer
language sql security definer set search_path = public as $$
  with ordem as (
    select c.id, row_number() over (partition by c.delivery_id order by c.dt_previsao nulls last, c.carga) as n
    from totvs_delivery_cargas c
    join totvs_deliveries d on d.id = c.delivery_id
    where d.pedido like 'ODOO-%'
  ), mudou as (
    update totvs_delivery_cargas c set tentativa = o.n
    from ordem o where o.id = c.id and c.tentativa is distinct from o.n
    returning 1
  ), totais as (
    update totvs_deliveries d set total_cargas = t.n
    from (select delivery_id, count(*)::int as n from totvs_delivery_cargas c
          join totvs_deliveries x on x.id = c.delivery_id and x.pedido like 'ODOO-%' group by 1) t
    where t.delivery_id = d.id and d.total_cargas is distinct from t.n
    returning 1
  )
  select (select count(*)::int from mudou) + (select count(*)::int from totais);
$$;

revoke all on function renumerar_tentativas_odoo() from public, anon, authenticated;
grant execute on function renumerar_tentativas_odoo() to service_role;
