alter table pedido_encomenda_events drop constraint if exists pedido_encomenda_events_event_type_check;
alter table pedido_encomenda_events add constraint pedido_encomenda_events_event_type_check
  check (event_type in ('created', 'status_changed', 'item_added', 'carga_informada', 'nf_e_informada', 'note_added', 'prazo_definido'));
