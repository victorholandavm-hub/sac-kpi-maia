-- Bug real, ao vivo -- pedido do Victor 03/09/2026 (print do erro): "está
-- aparecendo esse erro quando a assistencia tenta criar uma nova entrega":
-- "new row for relation service_requests violates check constraint
-- service_requests_type_check".
--
-- Mesma causa do bug de 0104_causa_raiz_sujeira_conferencia.sql: o tipo
-- "envio_recolhimento_peca" (Envio de peça com recolhimento de peça) foi
-- adicionado no código em 02/09/2026 (RequestType, ASSISTENCIA_MANAGED_TYPES,
-- SAC_ALSO_MANAGED_TYPES, DELIVERY_REQUEST_TYPES etc., ver assistenciaLabels.ts)
-- mas a constraint `service_requests_type_check` (0091_recolhimento_produto.sql)
-- nunca foi atualizada com esse valor novo -- ninguém conseguia criar esse
-- tipo de chamado desde que a opção apareceu na tela, sempre batendo nessa
-- constraint com o erro cru do Postgres.
alter table service_requests drop constraint if exists service_requests_type_check;
alter table service_requests add constraint service_requests_type_check
  check (type in (
    'montagem', 'desmontagem', 'recolhimento', 'troca_peca', 'vistoria', 'notificacao_externa',
    'troca_produto', 'entrega_produto', 'envio_peca', 'recolhimento_produto', 'envio_recolhimento_peca'
  ));
