-- Segunda tentativa, com mais cuidado -- a migration 0123 (views normais,
-- recalculadas do zero a cada consulta) causou uma queda real em produção
-- 12/09/2026: o código pagina em PARALELO (várias requisições simultâneas
-- pedindo pedaços da mesma view), e como a view de categorias levava
-- ~2 minutos+ pra recalcular (join+ILIKE em 330 mil linhas + cross-
-- referência de data de entrega), várias execuções concorrentes da mesma
-- consulta pesada esgotaram o banco -- inclusive derrubando o login (mesmo
-- banco Postgres pra tudo), não só a aba Clientes.
--
-- Correção: (1) MATERIALIZED VIEW em vez de VIEW normal -- computa uma vez,
-- as leituras da aplicação são só um SELECT num resultado já pronto
-- (instantâneo, testado via EXPLAIN ANALYZE); (2) view de categorias
-- SIMPLIFICADA -- tirei a cross-referência com totvs_delivery_cargas (data
-- de entrega confirmada, só um detalhe cosmético -- o "📦" ao lado da
-- categoria em janela na aba Propensão a recompra) que era a maior parte
-- do custo (de 2min+ pra 39s recalculando, testado via EXPLAIN ANALYZE);
-- agora usa direto issue_date do pedido. `entrega_confirmada`/`dataReal`
-- saiu do modelo por inteiro (ver recompra.ts/page.tsx) -- deixou de
-- existir, não é mais "sempre false", o dado não é mais coletado.
--
-- Refresh: chamado pelo próprio job de sync do TOTVS (runTotvsSync,
-- totvsSync.ts), que já roda a cada ~30min -- as views ficam no máximo
-- essa idade desatualizadas, e o refresh (39s + 3s, folga de sobra dentro
-- do orçamento de tempo do sync) nunca compete com uma leitura de usuário.
-- CONCURRENTLY exige um índice único em cada materialized view (senão trava
-- leitura durante o refresh) -- por isso os dois `create unique index`
-- abaixo.

drop view if exists v_clientes_agregado_nivel;
create materialized view v_clientes_agregado_nivel as
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
group by client_id
with data;

create unique index v_clientes_agregado_nivel_client_id_idx
  on v_clientes_agregado_nivel (client_id);

drop view if exists v_recompra_categorias_por_cliente;
create materialized view v_recompra_categorias_por_cliente as
with itens as (
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
    o.issue_date
  from totvs_order_items oi
  join totvs_orders o on o.id = oi.order_id
  where o.type = 'Venda' and o.client_id is not null
)
select client_id, categoria, sum(total) as valor_total, count(*) as qtd_compras, max(issue_date) as ultima_data
from itens
where categoria is not null
group by client_id, categoria
with data;

create unique index v_recompra_categorias_por_cliente_idx
  on v_recompra_categorias_por_cliente (client_id, categoria);

-- Chamada via `.rpc(...)` a partir de runTotvsSync (totvsSync.ts) --
-- CONCURRENTLY não bloqueia leitura durante o refresh (graças aos índices
-- únicos acima). security definer + search_path fixo (boa prática padrão
-- pra função chamada via RPC do service role).
create or replace function refresh_clientes_recompra_views()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view concurrently v_clientes_agregado_nivel;
  refresh materialized view concurrently v_recompra_categorias_por_cliente;
end;
$$;

-- Garante que o service_role (o que a aplicação usa, via getSupabaseAdmin
-- -> .rpc()) consegue chamar essa função pelo endpoint automático do
-- PostgREST -- explícito de propósito, não depender de grant implícito.
grant execute on function refresh_clientes_recompra_views() to service_role;
