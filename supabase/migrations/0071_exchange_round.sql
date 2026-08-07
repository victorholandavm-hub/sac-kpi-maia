-- Troca de produto pode precisar de mais de uma rodada (produto trocado
-- veio com problema de novo) -- ver requestNewExchange em
-- src/app/assistencia/actions.ts. exchange_round conta em que rodada o
-- chamado está (1 = ainda não precisou repetir), só usado pra tipo
-- troca_produto, mas fica com default 1 pra qualquer linha nova.

alter table service_requests add column if not exists exchange_round integer not null default 1;
