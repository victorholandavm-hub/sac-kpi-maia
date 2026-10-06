-- Cliente retira na loja: chamado de entrega/notificação que não sai em rota
-- (pedido do Victor 06/10/2026). Conclui igual aos outros, só não passa por
-- rota nem motorista.
alter table service_requests add column if not exists cliente_retira boolean not null default false;
