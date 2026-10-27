-- Pós-entrega e pós 20 dias das entregas do Odoo -- Victor 27/10/2026. Os de
-- sempre (entrega_nps / compra_nps) partem das entregas do Protheus (totvs_*,
-- FK pra totvs_orders) e não veem as entregas novas. Fonte: as baixas
-- "entregue" das cargas do Odoo (odoo_expedicao.resultado, gravado na leitura
-- das cargas). Uma linha por fase e pedido.
create table if not exists nps_entrega_odoo (
  fase text not null check (fase in ('entrega', 'compra')),
  pedido text not null,
  cliente text,
  telefone text,
  loja text,
  entregue_em date not null,
  ghl_contact_id text not null,
  ghl_location_id text,
  enviado_em timestamptz not null default now(),
  respondido_em timestamptz,
  score smallint check (score is null or (score between 1 and 5)),
  comentario text,
  descartada_em timestamptz,
  descarte_motivo text,
  primary key (fase, pedido)
);

create index if not exists nps_entrega_odoo_pendentes_idx on nps_entrega_odoo (fase, enviado_em) where respondido_em is null;
create index if not exists nps_entrega_odoo_telefone_idx on nps_entrega_odoo (fase, telefone, enviado_em);

alter table nps_entrega_odoo enable row level security;
