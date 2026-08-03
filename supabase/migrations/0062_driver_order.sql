-- Motorista consegue organizar a própria lista de chamados do dia na ordem
-- que quiser (ex.: seguir por bairro) -- ver setDriverOrderAction em
-- driver-actions.ts. Null = ainda não reorganizado, cai pro final da lista
-- e usa a ordenação padrão por horário (ver listRequestsForDriver).
alter table service_requests add column if not exists driver_order integer;
