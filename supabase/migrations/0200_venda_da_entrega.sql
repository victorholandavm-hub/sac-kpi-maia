-- (26/10/2026) Achado do Victor: a entrega era ligada à venda pelo número da
-- nota fiscal + série da carga, mas a nota da carga é a de REMESSA do CD
-- (numeração própria). O número coincidia com vendas de outras lojas e
-- outros clientes: em 60 dias, 71% das entregas "achavam" uma venda, e em
-- nenhuma era o mesmo cliente nem a mesma filial. Os NPS de entrega e de
-- compra (desde 22/09) foram pra quem não recebeu aquela entrega.
--
-- Venda certa de cada entrega: mesmo cliente (client_id) e mesma filial
-- (filial_venda = branch), emitida até a primeira previsão de carga e no
-- máximo 180 dias antes. Mais de uma candidata: fica a que tem mais produtos
-- em comum com os itens das cargas; empate, a mais recente. Mediu 95% das
-- entregas com venda achada (71% com uma só candidata); o resto é cliente
-- sem a venda sincronizada e fica sem ligação (nada é melhor que errado).
create or replace function venda_das_entregas(p_ids uuid[])
returns table (delivery_id uuid, order_id uuid, issue_date date, criterio text)
language sql
stable
security definer
set search_path = public
as $$
  with d as (
    select d.id, d.client_id, d.filial_venda,
           coalesce(min(c.dt_previsao), d.first_seen_at::date) as primeira_prev
    from totvs_deliveries d
    left join totvs_delivery_cargas c on c.delivery_id = d.id
    where d.id = any(p_ids)
    group by d.id
  ),
  produtos as (
    select c.delivery_id, array_agg(distinct i.produto) as lista
    from totvs_delivery_cargas c
    join totvs_delivery_carga_itens i on i.delivery_carga_id = c.id
    where c.delivery_id = any(p_ids)
    group by 1
  )
  select d.id, v.id, v.issue_date,
         case when v.em_comum > 0 then 'produto' when v.candidatas = 1 then 'unica' else 'mais_recente' end
  from d
  left join produtos p on p.delivery_id = d.id
  join lateral (
    select o.id, o.issue_date,
           (select count(distinct oi.product) from totvs_order_items oi
             where oi.order_id = o.id and oi.product = any(coalesce(p.lista, '{}'))) as em_comum,
           count(*) over () as candidatas
    from totvs_orders o
    where o.client_id = d.client_id
      and o.branch = d.filial_venda
      and o.type = 'Venda'
      and o.issue_date between d.primeira_prev - 180 and d.primeira_prev
    order by em_comum desc, o.issue_date desc, o.id
    limit 1
  ) v on true;
$$;

revoke all on function venda_das_entregas(uuid[]) from public, anon, authenticated;
grant execute on function venda_das_entregas(uuid[]) to service_role;
