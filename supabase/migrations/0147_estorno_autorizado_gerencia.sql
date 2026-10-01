-- Pergunta obrigatória "Estorno autorizado pela gerência?" no formulário de
-- solicitação -- pedido do Victor 01/10/2026. Distinto de `autorizado_por`
-- (texto livre, quem autorizou, sempre opcional) -- este é um sim/não
-- específico sobre autorização da gerência, e tem que ser respondido.
-- Default false só pra não quebrar as solicitações já existentes (dado
-- desconhecido pra elas); toda solicitação nova passa a exigir resposta
-- explícita via validação na server action.
alter table estorno_requests
  add column autorizado_gerencia boolean not null default false;
