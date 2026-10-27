-- Expedição só leitura pro SAC e a assistência -- Victor 27/10/2026. Marca
-- quando a saída apareceu pela última vez na expedição do Odoo (só a leitura
-- da expedição grava; a das cargas não). "Na fila agora" = vista na última
-- leitura.
alter table odoo_expedicao add column if not exists na_expedicao_em timestamptz;
create index if not exists odoo_expedicao_fila_idx on odoo_expedicao (na_expedicao_em);
