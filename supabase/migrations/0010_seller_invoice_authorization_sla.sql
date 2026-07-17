-- Campos que a planilha tinha e o app ainda não capturava:
-- vendedor(a) + nº da nota fiscal na solicitação, gerente que autorizou o
-- pagamento do montador, e prazo esperado (SLA) do pedido de peça.

alter table service_requests add column if not exists seller_name text;
alter table service_requests add column if not exists invoice_number text;

alter table service_request_items add column if not exists payment_authorized_by text;

alter table part_orders add column if not exists expected_at date;
update part_orders set expected_at = (created_at::date + 30) where expected_at is null;
