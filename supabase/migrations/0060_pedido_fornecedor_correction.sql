-- Corrige o check de event_type de pedido_encomenda_events pra incluir
-- 'edited' (usado por updatePedidoEncomendaContent desde sempre, mas nunca
-- tinha entrado nesse constraint -- a gravação do evento vinha falhando
-- silenciosamente porque o insert não checa erro) e o novo
-- 'fornecedor_changed', usado pela correção manual de fábrica/fornecedor
-- (ver updatePedidoFornecedor em src/lib/pedidosEncomenda.ts).

alter table pedido_encomenda_events drop constraint if exists pedido_encomenda_events_event_type_check;
alter table pedido_encomenda_events add constraint pedido_encomenda_events_event_type_check
  check (event_type in (
    'created', 'status_changed', 'item_added', 'carga_informada',
    'nf_e_informada', 'note_added', 'prazo_definido', 'edited', 'fornecedor_changed'
  ));
