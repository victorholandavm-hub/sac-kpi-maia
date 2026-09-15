-- Número da nota fiscal -- pedido do Victor 15/09/2026: "no chamado para
-- uma nova peça, na parte no botão E-mail, preciso que no assunto você
-- coloque o numero do chamado e no corpo do texto coloque o numero da
-- nota fiscal". Não existia campo nenhum pra isso em part_orders (a nota
-- fiscal de service_requests, service_requests.invoice_number, é de outro
-- fluxo -- entrega/troca de produto pelo SAC -- sem relação com pedido de
-- peça).
alter table part_orders add column invoice_number text;
