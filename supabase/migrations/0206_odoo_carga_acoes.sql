-- Quem fez cada passo da carga no CD (separação, conferência, liberação, saída, fim) -- Victor 26/10/2026:
-- "quem conferiu" nos eventos da carga. Gravado pelo acaoCargaAction depois que o Odoo aceita a ação
-- (operador = login do CD na tela de Logística). Se a gravação falhar, a ação no Odoo não é desfeita.
create table if not exists odoo_carga_acoes (
  id bigserial primary key,
  carga_id integer not null,
  romaneio text,
  acao text not null,
  estado text,
  operador text not null,
  em timestamptz not null default now()
);
create index if not exists odoo_carga_acoes_carga_idx on odoo_carga_acoes (carga_id, em);
alter table odoo_carga_acoes enable row level security;
