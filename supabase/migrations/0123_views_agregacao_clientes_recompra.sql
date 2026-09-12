-- Views de agregação pra cortar egress do Supabase -- pedido do Victor
-- 12/09/2026 (custo mensal, decisão Free vs Pro). Duas telas de
-- src/lib/clientes.ts e src/lib/recompra.ts traziam quase meio milhão de
-- linhas cruas (totvs_orders + totvs_order_items) pro Next.js só pra
-- agregar em JS, a cada 15min de cache expirado -- essas duas tabelas
-- cresceram muito com o backfill completo do TOTVS (2021-04 até hoje).
-- Mover a agregação pra dentro do Postgres (mesmo padrão já usado pro GHL:
-- v_ticket_enriched/v_conversation_tags/v_escalations, ver kpi.ts) faz o
-- banco devolver só o resultado já agregado -- de ~484 mil linhas cruas
-- por refresh pra algo entre 30-40 mil já agregadas.

-- View agregada por cliente (compras/gasto/datas/lojas) -- substitui o
-- scan completo de totvs_orders que listClientesPorNivelUncached
-- (clientes.ts) fazia linha por linha em JS. Mesma lógica exata: soma
-- invoice_total sempre sem inverter sinal (já vem líquido/assinado do
-- Protheus -- Venda soma, Devolução subtrai sozinha), conta só tipo
-- 'Venda' como compra, min/max issue_date também só de 'Venda'.
create or replace view v_clientes_agregado_nivel as
select
  client_id,
  max(client_name) as nome,
  max(client_cpf_cnpj) as cpf_cnpj,
  count(case when type = 'Venda' then 1 end) as compras,
  sum(invoice_total) as gasto_acumulado,
  min(case when type = 'Venda' then issue_date end) as primeira_compra,
  max(case when type = 'Venda' then issue_date end) as ultima_compra,
  array_remove(array_agg(distinct branch), null) as branches
from totvs_orders
where client_id is not null
group by client_id;

-- View agregada por cliente x categoria cíclica -- substitui
-- fetchCategoriasPorCliente (recompra.ts) inteira, incluindo o antigo
-- fetchDeliveryDatePorInvoiceSerie (agora um CTE aqui dentro).
--
-- ATENÇÃO -- duas listas duplicadas de propósito (mesmo espírito de
-- RESOLVIDO_LABELS em totvsSync.ts/entregasRisco.ts, já documentado como
-- duplicação aceita: "se mudar um, mudar o outro"):
--   1. As palavras-chave abaixo espelham CATEGORIAS_CICLO em
--      src/lib/recompra.ts, MESMA ORDEM (primeira que bater vence --
--      "PROTETOR DE COLCHAO" precisa cair em "protetor" antes de bater
--      em "colchao"). Mudou uma lista, muda a outra.
--   2. 'Entregue'/'Entregue Parcial' abaixo espelham RESOLVIDO_LABELS em
--      src/lib/entregasRisco.ts.
--
-- Preferência de data: usa a data de entrega confirmada
-- (totvs_delivery_cargas, pela chave invoice+serie, só entregas
-- RESOLVIDO_LABELS, a de dt_retorno mais recente quando há mais de uma
-- tentativa) quando existe; cai pra issue_date do pedido quando não.
create or replace view v_recompra_categorias_por_cliente as
with entregas as (
  select distinct on (nota_fiscal, serie) nota_fiscal, serie, dt_retorno
  from totvs_delivery_cargas
  where nota_fiscal is not null and serie is not null and dt_retorno is not null
    and status_entrega in ('Entregue', 'Entregue Parcial')
  order by nota_fiscal, serie, dt_retorno desc
),
itens as (
  select
    o.client_id,
    case
      when oi.description ilike '%PROTETOR%' then 'protetor'
      when oi.description ilike '%TRAVESSEIRO%' or oi.description ilike '%TRAV %' then 'travesseiro'
      when oi.description ilike '%COLCHAO%' or oi.description ilike '%BOX %' then 'colchao'
      when oi.description ilike '%SOFA%' or oi.description ilike '%ESTOFAD%' or oi.description ilike '%POLTRONA%' then 'estofado'
      when oi.description ilike '%BERCO%' or oi.description ilike '%BELICHE%' or oi.description ilike '%CAMA %' then 'cama'
      when oi.description ilike '%ROUPEIRO%' or oi.description ilike '%GUARDA-ROUPA%' or oi.description ilike '%GUARDA ROUPA%' or oi.description ilike '%ARMARIO%' or oi.description ilike '%MULTI-USO%' then 'roupeiro'
      when oi.description ilike '%MESA%' or oi.description ilike '%RACK%' or oi.description ilike '%ESTANTE%' or oi.description ilike '%COMODA%' then 'mesa'
    end as categoria,
    oi.total,
    coalesce(e.dt_retorno, o.issue_date) as data_efetiva,
    (e.dt_retorno is not null) as entrega_confirmada
  from totvs_order_items oi
  join totvs_orders o on o.id = oi.order_id
  left join entregas e on e.nota_fiscal = o.invoice and e.serie = o.serie
  where o.type = 'Venda' and o.client_id is not null
),
categorizados as (
  select * from itens where categoria is not null
),
agregados as (
  select client_id, categoria, sum(total) as valor_total, count(*) as qtd_compras
  from categorizados
  group by client_id, categoria
),
ultimos as (
  select distinct on (client_id, categoria)
    client_id, categoria, data_efetiva as ultima_data, entrega_confirmada
  from categorizados
  order by client_id, categoria, data_efetiva desc
)
select a.client_id, a.categoria, u.ultima_data, u.entrega_confirmada, a.valor_total, a.qtd_compras
from agregados a
join ultimos u using (client_id, categoria);
