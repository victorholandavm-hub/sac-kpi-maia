-- (26/10/2026) NPS de entrega e de compra enviados pra pessoa errada desde
-- 22/09 (a venda era achada pela nota de remessa da carga -- ver 0200). As
-- respostas não medem a entrega de ninguém e as notas baixas entravam na
-- lista de detratores do SAC. Pedido do Victor: descartar em vez de apagar
-- -- o registro de quem recebeu a mensagem fica, só sai das notas, dos
-- resumos e da lista de detratores. venda_nps ganha as mesmas colunas pra
-- o código que serve as três tabelas não precisar de exceção (lá ficam vazias).
alter table entrega_nps add column if not exists descartada_em timestamptz;
alter table entrega_nps add column if not exists descarte_motivo text;
alter table compra_nps add column if not exists descartada_em timestamptz;
alter table compra_nps add column if not exists descarte_motivo text;
alter table venda_nps add column if not exists descartada_em timestamptz;
alter table venda_nps add column if not exists descarte_motivo text;
