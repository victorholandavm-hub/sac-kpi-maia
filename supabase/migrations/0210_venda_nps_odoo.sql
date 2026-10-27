-- NPS de atendimento em loja para as vendas do Odoo -- Victor 27/10/2026. O
-- NPS de venda (venda_nps) parou na virada (25/10): ele parte de totvs_orders
-- (Protheus congelado) e tem FK pra lá. Enquanto a ponte não lista as vendas do
-- dia, a fonte é a expedição do Odoo (odoo_expedicao, venda nova = legado
-- false): entrega e "retira depois". Venda levada na hora no balcão não passa
-- por lá e fica de fora.
alter table odoo_expedicao add column if not exists vendedor text;

create table if not exists venda_nps_odoo (
  pedido text primary key,
  cliente text,
  telefone text,
  loja text,
  vendedor text,
  data_venda date not null,
  ghl_contact_id text not null,
  ghl_location_id text,
  enviado_em timestamptz not null default now(),
  respondido_em timestamptz,
  score smallint check (score is null or (score between 1 and 5)),
  comentario text,
  descartada_em timestamptz,
  descarte_motivo text
);

create index if not exists venda_nps_odoo_pendentes_idx on venda_nps_odoo (enviado_em) where respondido_em is null;
create index if not exists venda_nps_odoo_telefone_idx on venda_nps_odoo (telefone, enviado_em);

alter table venda_nps_odoo enable row level security;
