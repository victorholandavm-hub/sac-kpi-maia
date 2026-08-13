-- Índices que faltavam nas tabelas do TOTVS mais lidas por "Vendas por
-- produto" (src/lib/vendasProduto.ts) -- sem eles, toda consulta filtrando
-- por produto ou por status/data de entrega varria a tabela inteira. O
-- volume de totvs_order_items só cresce (sync agora roda a cada 30min,
-- histórico foi estendido pra 26 semanas em 2026-08-13), então esses full
-- scans iam ficando mais lentos com o tempo.
--
-- totvs_order_items.product: usado em getVendaCurvaProduto (.eq) e em
-- listTendenciaProdutos/listSaldoEstoqueProdutos (.in com os códigos do
-- ranking). totvs_order_items_order_id_idx já existia (0039_totvs_sync.sql),
-- esse cobre o outro filtro mais comum da tela.
create index if not exists totvs_order_items_product_idx on totvs_order_items (product);

-- totvs_delivery_cargas.status_entrega + dt_retorno: usado por
-- buildDespachoPorSemana (gráfico "Vendido x despachado"), toda vez que a
-- tela de vendas é aberta -- filtra status_entrega = 'Entregue' num range de
-- dt_retorno. Só existiam índices em dt_previsao e nota_fiscal/serie, que não
-- ajudam essa consulta.
create index if not exists totvs_delivery_cargas_status_dt_retorno_idx on totvs_delivery_cargas (status_entrega, dt_retorno);
