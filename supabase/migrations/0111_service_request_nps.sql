-- NPS pós-montagem e pós-assistência técnica via WhatsApp (GHL) -- pedido
-- do Victor 07/09/2026: "quero só saber como seria para coletarmos NPS
-- pós montagem, pós assistencia técnica e 1 mês após a compra via api
-- oficial". Essa tabela cobre os 2 primeiros gatilhos (o de pós-compra,
-- 1 mês depois, referencia totvs_orders em vez de service_requests --
-- fica pra uma tabela separada quando chegar a hora).
--
-- Uma linha por chamado concluído elegível (request_id único) -- o job de
-- sync usa "não existe linha aqui ainda" como critério de "ainda não
-- mandei a pesquisa pra esse chamado".
create table if not exists service_request_nps (
  request_id uuid primary key references service_requests(id) on delete cascade,
  tipo text not null check (tipo in ('montagem', 'assistencia_tecnica')),
  ghl_contact_id text not null,
  enviado_em timestamptz not null default now(),
  respondido_em timestamptz,
  score smallint check (score is null or (score >= 0 and score <= 10)),
  comentario text
);

create index if not exists service_request_nps_pendente_idx
  on service_request_nps (enviado_em)
  where respondido_em is null;
