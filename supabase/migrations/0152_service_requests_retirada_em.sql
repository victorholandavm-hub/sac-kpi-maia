-- Retirada pelo cliente: na loja ou no CD (substitui cliente_retira, 0151).
-- Nenhum chamado tinha o campo marcado antes desta migration.
alter table service_requests add column if not exists retirada_em text check (retirada_em in ('loja', 'cd'));
alter table service_requests drop column if exists cliente_retira;
