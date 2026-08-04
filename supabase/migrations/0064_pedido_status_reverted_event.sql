-- undoLastPedidoStatusChange gravava o próprio desfazer como um evento
-- 'status_changed' comum -- isso deixava um segundo "↺ Desfazer" (dentro da
-- janela de 10min) reverter esse desfazer, ou seja, refazer a mudança
-- original (toggle sem fim). Um event_type dedicado deixa esse evento fora
-- do critério de "última mudança é status_changed" que habilita o botão de
-- desfazer, fechando o toggle.
alter table pedido_encomenda_events drop constraint if exists pedido_encomenda_events_event_type_check;
alter table pedido_encomenda_events add constraint pedido_encomenda_events_event_type_check
  check (event_type in (
    'created', 'status_changed', 'item_added', 'carga_informada',
    'nf_e_informada', 'note_added', 'prazo_definido', 'edited',
    'fornecedor_changed', 'status_reverted'
  ));
