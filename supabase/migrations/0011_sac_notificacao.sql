-- Estrutura pro processo de SAC/Notificação (reclamação de entrega, cobrança,
-- avaria etc.) descrito no playbook — hoje só existia como um tipo genérico
-- "notificacao_externa", sem categoria, protocolo, prazo legal ou sinalização
-- de risco de escalonamento.

alter table service_requests add column if not exists sac_category text;
alter table service_requests add column if not exists protocol_number text;
alter table service_requests add column if not exists legal_deadline date;
alter table service_requests add column if not exists escalation_risk boolean not null default false;

create index if not exists service_requests_escalation_risk_idx on service_requests (escalation_risk) where escalation_risk = true;
