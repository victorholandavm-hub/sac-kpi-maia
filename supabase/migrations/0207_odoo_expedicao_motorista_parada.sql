-- Motorista/veículo da carga e a parada do pedido -- Victor 27/10/2026: "dá
-- pra ver o motorista que entregou / está com o pedido em rota? e as fotos
-- da entrega?". Gravados só pela leitura das cargas (a expedição não zera):
-- com ultima_carga_id + parada_id as fotos saem do disco
-- (odoo-entregas/carga-X/parada-Y), mesmo depois de o pedido voltar pra fila.
alter table odoo_expedicao add column if not exists carga_motorista text;
alter table odoo_expedicao add column if not exists carga_veiculo text;
alter table odoo_expedicao add column if not exists parada_id integer;
alter table odoo_expedicao add column if not exists ultima_carga_id integer;
