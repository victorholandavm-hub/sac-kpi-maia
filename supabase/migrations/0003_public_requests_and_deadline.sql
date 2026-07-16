-- Simplifica a identificação de quem solicita (não precisa mais de login/perfil de
-- gerente — só primeiro nome + loja) e adiciona negociação de prazo entre a loja e a
-- assistência.

alter table service_requests alter column requested_by drop not null;
alter table service_requests add column if not exists requested_by_name text;
alter table service_requests add column if not exists requested_deadline date;
alter table service_requests add column if not exists deadline_status text not null default 'pendente';
alter table service_requests add constraint service_requests_deadline_status_check
  check (deadline_status in ('pendente', 'aprovado', 'recusado'));
alter table service_requests add column if not exists approved_deadline date;

-- Novos tipos de evento para a aprovação/recusa de prazo.
alter table service_request_events drop constraint if exists service_request_events_event_type_check;
alter table service_request_events add constraint service_request_events_event_type_check
  check (event_type in ('created', 'status_changed', 'assigned', 'note_added', 'deadline_approved', 'deadline_rejected'));

-- A criação de solicitações agora também acontece sem sessão do Supabase Auth
-- (formulário público protegido por Basic Auth próprio, ver src/proxy.ts), então a
-- policy de insert baseada em profiles.role = 'gerente' deixa de ser o único caminho.
-- Mantemos a policy existente (ela só afeta acesso via anon/authenticated key; a
-- aplicação sempre grava via service role) e adicionamos leitura pública zero — a
-- tabela stores já é legível por authenticated, o formulário público lê via service role.
