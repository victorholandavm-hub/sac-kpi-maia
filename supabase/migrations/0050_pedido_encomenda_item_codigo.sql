-- Código do produto (TOTVS) por item de pedido de encomenda -- mesma ideia de
-- part_code em service_request_items: só referência/atalho pra autopreencher
-- a descrição no formulário (ver lookupTotvsProductForEncomenda), não valida
-- contra nada.
alter table pedido_encomenda_itens add column if not exists produto_codigo text;
