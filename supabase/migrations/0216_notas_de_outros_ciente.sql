-- Notas de entrega faturadas por outras pessoas -- Victor 29/10/2026 ("todas
-- as notas que qualquer outra pessoa faturar, que não seja Adonis ou John,
-- precisa aparecer para o John"). A emissão é a saída da carga ("sair" em
-- odoo_carga_acoes, 0206); aqui fica quem deu ciente e quando.
create table if not exists notas_de_outros_ciente (
  acao_id bigint primary key references odoo_carga_acoes (id) on delete cascade,
  ciente_por text not null,
  ciente_em timestamptz not null default now()
);

create index if not exists odoo_carga_acoes_acao_em_idx on odoo_carga_acoes (acao, em);

alter table notas_de_outros_ciente enable row level security;
