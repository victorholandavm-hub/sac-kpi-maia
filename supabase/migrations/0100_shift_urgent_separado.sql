-- Urgência vira campo separado do turno -- pedido do Victor 27/08/2026:
-- "preciso que na notificaçã de assietencia, eu possa colocar o periodo, o
-- horario e tenha a opção de colocar urgencia tambem, pois hoje, quando
-- coloco que precisa ser no periodo da tarde, ele nao me da a opção de
-- colocar como urgencia tambem". Antes "urgencia" era só mais um VALOR de
-- `shift` (junto de manha/tarde/dia), mutuamente exclusivo com qualquer
-- período de verdade -- ver 0009_agenda_scheduling.sql.
alter table service_requests add column if not exists urgent boolean not null default false;

-- Backfill: quem tinha "urgencia" como turno vira urgent=true, sem período
-- nenhum -- é exatamente o que já estava valendo antes, só que expresso nos
-- 2 campos novos em vez de um valor emprestado do outro.
update service_requests set urgent = true, shift = null where shift = 'urgencia';

-- Constraint original (0009_agenda_scheduling.sql) foi criada inline no ADD
-- COLUMN, sem nome explícito -- Postgres nomeia como
-- "service_requests_shift_check" (mesmo padrão já confirmado em
-- 0080_causa_raiz_conferencia_motorista.sql pra outro constraint).
alter table service_requests drop constraint if exists service_requests_shift_check;
alter table service_requests add constraint service_requests_shift_check
  check (shift is null or shift in ('manha', 'tarde', 'dia'));
