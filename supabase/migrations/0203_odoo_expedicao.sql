-- Retrato da expedição do Odoo (ponte do Pedro, /logistica/expedicao) -- Victor
-- 26/10/2026: o SAC precisa imprimir a nota do cliente e a impressão da ponte
-- (/pedido/{id}/danfe.pdf) pede o id numérico do pedido no Odoo, que nenhuma
-- tabela nossa tinha (o sync pela camada compat grava só "ODOO-S01589").
-- Uma linha por saída (stock.picking); a saída some da expedição quando é
-- entregue, mas a linha fica aqui (visto_em para de andar).

create table if not exists odoo_expedicao (
  picking_id integer primary key,
  pedido text not null,
  pedido_id integer,
  company_id integer not null,
  empresa text,
  cliente text,
  cliente_id integer,
  telefone text,
  nf5922 text,
  nf5117 text,
  legado boolean not null default false,
  modo text,
  estado text,
  filial_entrega text,
  primeiro_visto timestamptz not null default now(),
  visto_em timestamptz not null default now()
);

create index if not exists odoo_expedicao_pedido_idx on odoo_expedicao (pedido);
create index if not exists odoo_expedicao_cliente_idx on odoo_expedicao (lower(cliente));

alter table odoo_expedicao enable row level security;
