-- Vendas do Protheus que o sync antigo perdeu -- Victor 27/10/2026 (ex.:
-- Janicleide, NF 23797/207 de 30/09 nunca entrou em totvs_orders). A compat do
-- Pedro responde /rest/orders lendo direto o SQL do Protheus; a cópia de
-- madrugada passa dia a dia e insere só o que falta (nada existente é
-- reescrito). Esta tabela guarda os dias já conferidos.
create table if not exists protheus_vendas_completadas (
  dia date primary key,
  notas integer not null default 0,
  inseridas integer not null default 0,
  feito_em timestamptz not null default now()
);

alter table protheus_vendas_completadas enable row level security;
