-- Previsão de entrega da encomenda -- fábrica ou CD definem/atualizam a
-- qualquer momento (sempre opcional, não travado a nenhuma transição de
-- status), pra loja saber quando esperar o produto.
alter table pedidos_encomenda add column if not exists prazo_entrega date;
