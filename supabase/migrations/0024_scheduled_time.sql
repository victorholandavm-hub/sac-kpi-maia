-- Hora da visita agendada, além da data e do turno (manhã/tarde/dia/urgência)
-- que já existiam — pedido pra marcar um horário específico de montagem.

alter table service_requests add column if not exists scheduled_time time;
