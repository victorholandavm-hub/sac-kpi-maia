-- Numa solicitação combo (montagem + desmontagem no mesmo chamado, ver
-- combo_montagem_desmontagem em service_requests), os itens precisam dizer
-- qual ação é a deles -- sem isso, montador e assistência só viam uma lista
-- única de produtos sem saber o que monta e o que desmonta. Nulo pra
-- chamados sem combo (o tipo do chamado já diz a ação de todos os itens).

alter table service_request_items add column if not exists item_action text
  check (item_action in ('montar', 'desmontar'));
