-- Assistência consegue organizar a fila na ordem que quiser (ex.: por
-- bairro, pra despachar montador) -- ver setAssistenciaOrderAction em
-- actions.ts. Null = ainda não reorganizado, cai pro final e usa a
-- ordenação padrão (created_at desc, ver listRequests). Mesmo padrão de
-- driver_order (0062_driver_order.sql), só que pra fila da assistência em
-- vez da rota do motorista.
alter table service_requests add column if not exists assistencia_order integer;
