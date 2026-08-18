-- Cadeia de trocas ligadas (pedido do Victor 18/08/2026): "Nova troca"
-- deixa de reabrir o MESMO chamado (perdia a 1ª troca -- itens/fotos/data de
-- conclusão ficavam sobrescritos pela rodada seguinte) e passa a criar um
-- chamado NOVO, com número próprio, apontando pro anterior. exchange_round
-- (já existia desde 0071) muda de sentido: antes contava quantas vezes essa
-- MESMA linha foi reaberta; agora é a posição do chamado na própria cadeia,
-- definida uma vez na criação e nunca mais mudada.
--
-- on delete set null (não cascade) -- não existe fluxo de apagar chamado
-- hoje, mas se um dia existir, apagar o pai não pode levar o filho junto.
alter table service_requests
  add column if not exists parent_request_id uuid references service_requests (id) on delete set null;

-- Só um filho por chamado (a próxima rodada) -- índice único parcial em vez
-- de checar na aplicação evita a corrida de dois cliques em "Nova troca"
-- quase juntos criarem duas trocas filhas pro mesmo pai.
create unique index if not exists service_requests_parent_unique_idx
  on service_requests (parent_request_id) where parent_request_id is not null;
