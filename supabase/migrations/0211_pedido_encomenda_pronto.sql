-- Fase "Pronto" do pedido de encomenda -- Victor 27/10/2026: depois de "Em
-- produção", a fábrica marca "Pronto" antes de "Enviado para o CD".
alter table pedidos_encomenda drop constraint if exists pedidos_encomenda_status_check;
alter table pedidos_encomenda add constraint pedidos_encomenda_status_check
  check (status in ('solicitado', 'em_producao', 'pronto', 'pronto_para_expedicao', 'em_carga', 'faturado', 'entregue', 'cancelado', 'negado', 'recebido_cd'));
