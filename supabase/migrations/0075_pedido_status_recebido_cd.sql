-- Novo status "recebido_cd" ("Recebido pelo CD / Em estoque") -- caminho
-- alternativo a partir de pronto_para_expedicao pra pedidos que não vão pra
-- loja (venda direta do CD pro cliente). Ver src/lib/dal.ts (CD_TRANSITIONS)
-- e src/components/assistencia/PedidoEncomendaActions.tsx.

alter table pedidos_encomenda drop constraint if exists pedidos_encomenda_status_check;
alter table pedidos_encomenda add constraint pedidos_encomenda_status_check
  check (status in ('solicitado', 'em_producao', 'pronto_para_expedicao', 'em_carga', 'faturado', 'entregue', 'cancelado', 'negado', 'recebido_cd'));
