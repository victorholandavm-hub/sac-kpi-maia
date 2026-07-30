-- Perfil do Cliente: agrega totvs_orders por cliente (cpf_cnpj) pra
-- alimentar a visão de segmentos (src/lib/customerProfile.ts,
-- listClientSegments) sem puxar todo pedido pra Node a cada carregamento da
-- tela -- só essa view (1 linha por cliente) é buscada e agregada em
-- memória, no mesmo estilo de src/lib/kpi.ts. O perfil individual (1
-- cliente só) NÃO usa essa view: consulta totvs_orders/totvs_order_items
-- direto, filtrado por cpf_cnpj, porque pra 1 cliente já é barato e evita
-- duas fontes de verdade calculando "ticket médio" de formas diferentes.
--
-- Devolução (type='Devolucao') já chega com quantity/total/invoice_total
-- negativos (não é só um rótulo) -- por isso valor_liquido soma tudo sem
-- filtro (o sinal já compensa) enquanto as métricas "de venda" (contagem,
-- valor bruto, ticket médio, datas) filtram type='Venda', senão devolução
-- infla "quantas vezes o cliente comprou".
--
-- View simples, não materializada: totvs_orders já tem índice em
-- client_cpf_cnpj e o agrupamento é um GROUP BY direto sem join -- barato
-- de rodar sob demanda numa tela administrativa aberta esporadicamente. Não
-- materializar agora (exigiria mecanismo de refresh que não existe no
-- projeto) -- YAGNI, mesma filosofia do resto do repo.
--
-- Sem RLS na view: Postgres não permite RLS em view (é recurso de tabela).
-- A proteção real é a mesma de toda leitura do projeto: só
-- getSupabaseAdmin() (service_role, ignora RLS) consulta isso -- igual
-- totvs_clientes/totvs_orders, que já têm RLS habilitado sem nenhuma
-- policy (0039_totvs_sync.sql).

create or replace view v_client_purchase_summary as
select
  client_cpf_cnpj as cpf_cnpj,
  count(*) filter (where type = 'Venda') as total_compras,
  coalesce(sum(invoice_total) filter (where type = 'Venda'), 0) as valor_bruto,
  coalesce(sum(invoice_total), 0) as valor_liquido,
  avg(invoice_total) filter (where type = 'Venda') as ticket_medio,
  min(issue_date) filter (where type = 'Venda') as primeira_compra,
  max(issue_date) filter (where type = 'Venda') as ultima_compra
from totvs_orders
where client_cpf_cnpj is not null
group by client_cpf_cnpj;
