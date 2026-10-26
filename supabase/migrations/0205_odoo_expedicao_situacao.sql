-- Situação do pedido do Odoo na consulta (em separação, qual carga, previsão
-- de carga/entrega, resultado) -- Victor 26/10/2026: "está faltando
-- informações sobre os pedidos". Expedição grava programação/pendência e a
-- carga em que a saída está; a leitura das cargas grava situação, datas e o
-- resultado da parada.
alter table odoo_expedicao add column if not exists data_programada date;
alter table odoo_expedicao add column if not exists pendencia_motivo text;
alter table odoo_expedicao add column if not exists carga_id integer;
alter table odoo_expedicao add column if not exists carga_romaneio text;
alter table odoo_expedicao add column if not exists carga_estado text;
alter table odoo_expedicao add column if not exists carga_prevista date;
alter table odoo_expedicao add column if not exists carga_saiu_em timestamptz;
alter table odoo_expedicao add column if not exists carga_fim_em timestamptz;
alter table odoo_expedicao add column if not exists resultado text;
