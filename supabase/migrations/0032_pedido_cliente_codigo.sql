-- Código do cliente na encomenda -- útil pra CD/fábrica e pra própria loja
-- identificarem de quem é aquele pedido quando ele chegar (não é FK pra
-- nenhuma tabela de clientes, é só um código informado pela caixa/vendedor
-- na hora de solicitar).
alter table pedidos_encomenda add column if not exists cliente_codigo text;
