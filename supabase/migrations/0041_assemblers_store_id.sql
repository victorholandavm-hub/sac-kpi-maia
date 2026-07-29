-- Permite gerente de loja cadastrar montador escopado só pra loja dele
-- (src/app/assistencia/loja-equipe-actions.ts). Nullable de propósito: os
-- montadores já cadastrados hoje (globais, sem loja) continuam funcionando
-- em qualquer loja -- só os novos, adicionados por gerente, ganham
-- store_id. Nome continua único pra empresa toda (decisão deliberada, não
-- mexe no login que é só nome+PIN).

alter table assemblers add column if not exists store_id text references stores (id);

create index if not exists assemblers_store_id_idx on assemblers (store_id);
