-- As 4 pesquisas adicionais (montagem, assistência técnica, entrega,
-- compra) passam a usar a MESMA escala 1-5 do NPS do SAC -- pedido do
-- Victor 22/09/2026: "eu prefiro como funciona hoje a avaliação do sac"
-- (WhatsApp List Message com 5 opções -- "5 - Muito satisfeito" até "1 -
-- Muito insatisfeito" -- em vez de pedir um número livre de 0 a 10
-- digitado à mão). Sem dado existente pra migrar -- as 3 tabelas só têm
-- linhas de matrícula recém-criadas, nenhuma com score ainda (conferido
-- antes de aplicar esta migration).
alter table service_request_nps drop constraint if exists service_request_nps_score_check;
alter table service_request_nps add constraint service_request_nps_score_check
  check (score is null or (score >= 1 and score <= 5));

alter table compra_nps drop constraint if exists compra_nps_score_check;
alter table compra_nps add constraint compra_nps_score_check
  check (score is null or (score >= 1 and score <= 5));

alter table entrega_nps drop constraint if exists entrega_nps_score_check;
alter table entrega_nps add constraint entrega_nps_score_check
  check (score is null or (score >= 1 and score <= 5));
