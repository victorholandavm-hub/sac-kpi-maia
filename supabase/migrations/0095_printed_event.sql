-- Pedido do Victor 21/08/2026: "quando alguem mandar imprimir essas
-- notificações fique registrado em algum lugar quem imprimiu, data e
-- hora". Reaproveita service_request_events (mesma tabela de sempre --
-- actor_id + created_at já dão quem e quando de graça) em vez de criar
-- uma tabela nova só pra isso -- ver logPrint em actions.ts.
alter table service_request_events drop constraint if exists service_request_events_event_type_check;
alter table service_request_events add constraint service_request_events_event_type_check
  check (event_type in ('created', 'status_changed', 'assigned', 'note_added', 'deadline_approved', 'deadline_rejected', 'edited', 'printed'));
