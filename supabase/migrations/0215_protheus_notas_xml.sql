-- XML das notas de venda do Protheus guardados no nosso disco -- Victor
-- 27/10/2026. A ponte do Pedro gera a DANFE e devolve o XML pela chave
-- (/nota/<chave>/xml, lendo o SPED050/054 do Protheus): se o servidor do
-- Protheus for desligado, essas notas somem. A cópia de madrugada baixa o XML
-- de cada venda com chave em totvs_orders (NOTAS_PROTHEUS_DIR/<chave>.xml)
-- pra guarda de 5 anos; esta tabela é o índice (e o que já foi feito).
create table if not exists protheus_notas_xml (
  chave text primary key,
  invoice text,
  branch text,
  issue_date date,
  bytes integer,
  salvo_em timestamptz not null default now()
);

create index if not exists protheus_notas_xml_data_idx on protheus_notas_xml (issue_date);

alter table protheus_notas_xml enable row level security;
