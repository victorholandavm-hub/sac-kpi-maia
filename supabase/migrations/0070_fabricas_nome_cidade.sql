-- src/lib/fabricas.ts já foi atualizado pra distinguir as duas fábricas
-- próprias pelo nome da cidade (INTERNAL_FABRICAS), mas isso só cobre o
-- formulário de criar pedido -- a listagem de pedidos (fila, "Todas as
-- encomendas" do SAC etc.) lê o nome direto da tabela `fabricas` via join
-- (ver toSummary em src/lib/pedidosEncomenda.ts), que continuava com o nome
-- antigo sem cidade. Sincroniza a tabela com a mesma fonte única.

update fabricas set nome = '(Conde) Beds/Aiam Colchões' where id = 'colchoes';
update fabricas set nome = '(Bayeux) Beds/Aiam Estofados' where id = 'estofados';
