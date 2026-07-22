-- Avaliação do cliente (0 a 10) coletada pelo motorista na hora de concluir
-- a rota de troca de produto: nota da entrega e nota da resolução do
-- problema. Ambas opcionais — o motorista pode pular se o cliente não
-- quiser avaliar.

alter table service_requests add column if not exists delivery_rating smallint;
alter table service_requests add column if not exists resolution_rating smallint;

alter table service_requests drop constraint if exists service_requests_delivery_rating_check;
alter table service_requests add constraint service_requests_delivery_rating_check
  check (delivery_rating is null or (delivery_rating >= 0 and delivery_rating <= 10));

alter table service_requests drop constraint if exists service_requests_resolution_rating_check;
alter table service_requests add constraint service_requests_resolution_rating_check
  check (resolution_rating is null or (resolution_rating >= 0 and resolution_rating <= 10));
