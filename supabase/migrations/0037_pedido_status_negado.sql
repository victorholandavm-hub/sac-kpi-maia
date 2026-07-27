alter table pedidos_encomenda drop constraint if exists pedidos_encomenda_status_check;
alter table pedidos_encomenda add constraint pedidos_encomenda_status_check
  check (status in ('solicitado', 'em_producao', 'pronto_para_expedicao', 'em_carga', 'faturado', 'entregue', 'cancelado', 'negado'));
