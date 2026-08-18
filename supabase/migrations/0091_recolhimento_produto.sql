-- Tipo novo (pedido do Victor 18/08/2026): "Recolhimento de produto" -- o
-- SAC recolhe o produto do cliente sem entregar nada no lugar (ex.:
-- devolução/cancelamento), diferente de troca_produto (recolhe E entrega) e
-- de entrega_produto (só entrega, nunca recolhe). "recolhimento" (sem
-- "_produto") já existe e é outra coisa -- recolhimento de PEÇA, exclusivo
-- da Assistência.
alter table service_requests drop constraint if exists service_requests_type_check;
alter table service_requests add constraint service_requests_type_check
  check (type in ('montagem', 'desmontagem', 'recolhimento', 'troca_peca', 'vistoria', 'notificacao_externa', 'troca_produto', 'entrega_produto', 'envio_peca', 'recolhimento_produto'));
