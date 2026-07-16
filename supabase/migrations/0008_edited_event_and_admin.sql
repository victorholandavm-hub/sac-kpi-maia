-- Novo tipo de evento para registrar correções manuais em solicitações.

alter table service_request_events drop constraint if exists service_request_events_event_type_check;
alter table service_request_events add constraint service_request_events_event_type_check
  check (event_type in ('created', 'status_changed', 'assigned', 'note_added', 'deadline_approved', 'deadline_rejected', 'edited'));
