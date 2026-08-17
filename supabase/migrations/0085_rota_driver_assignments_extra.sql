-- "Rota extra" -- pedido do Victor 17/08/2026: só existe UMA rota
-- principal por dia (o carro de sempre), mas pode ter mais carro(s) saindo
-- no mesmo dia, cadastrados à parte como "rota extra". Antes o "motorista
-- do dia" (0084) tratava as 3 rotas (praia/sul/centro) como 3 slots sempre
-- editáveis simultaneamente pro mesmo dia -- não bate com a operação real
-- (só uma rota é a do dia; qualquer carro a mais é exceção/reforço).

alter table rota_driver_assignments add column if not exists is_extra boolean not null default false;

-- Solta a restrição antiga (uma linha por rota+dia) -- agora pode ter
-- várias linhas "extra" pra mesma rota/dia, se precisar de mais de um
-- carro extra na mesma região.
alter table rota_driver_assignments drop constraint if exists rota_driver_assignments_assignment_date_rota_key;

-- Só uma linha PRINCIPAL (não-extra) por dia -- índice único parcial, já
-- que `unique(assignment_date)` sozinho bloquearia as linhas extra também.
create unique index if not exists rota_driver_assignments_one_primary_per_day
  on rota_driver_assignments (assignment_date)
  where not is_extra;
