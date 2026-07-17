-- Traz para dentro do app a inteligência da planilha "Agenda de Assistência"
-- (agendamento de visitas técnicas na casa do cliente: data, turno, técnico,
-- reagendamento) — sem importar nenhum histórico, só a estrutura, pra tudo
-- daqui pra frente ser lançado direto aqui.

alter table service_requests add column if not exists scheduled_date date;
alter table service_requests add column if not exists shift text
  check (shift in ('manha', 'tarde', 'dia', 'urgencia'));

create index if not exists service_requests_scheduled_date_idx on service_requests (scheduled_date);

-- Novo status "remarcar" (visita agendada que precisou ser remarcada).
alter table service_requests drop constraint if exists service_requests_status_check;
alter table service_requests add constraint service_requests_status_check
  check (status in ('aberta', 'em_contato', 'em_andamento', 'remarcar', 'concluida', 'cancelada'));

-- Dois tipos que a planilha usava e o app ainda não tinha: troca de peça
-- avulsa (diferente de "recolhimento") e vistoria técnica.
alter table service_requests drop constraint if exists service_requests_type_check;
alter table service_requests add constraint service_requests_type_check
  check (type in ('montagem', 'desmontagem', 'recolhimento', 'troca_peca', 'vistoria', 'notificacao_externa'));

-- Técnicos de campo da planilha (mesma equipe dos montadores, confirmado com o usuário).
insert into assemblers (name) values ('Manoel'), ('Léo'), ('Arthur')
on conflict (name) do nothing;
