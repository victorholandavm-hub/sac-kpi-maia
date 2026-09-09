-- NPS "2 meses pós-recebimento" -- pedido do Victor 09/09/2026: "Cliente
-- so pode receber uma a cada 90 dias. Gatilho é a data de entrega, e
-- coloque 2 meses apos o recebimento e nao um [mês]". Diferente dos outros
-- 3 tipos de NPS (que vivem em service_request_nps, um chamado de
-- assistência por trás): esse é por PEDIDO de venda (totvs_orders), sem
-- chamado nenhum envolvido -- daí a tabela própria.
--
-- client_id (não só order_id) fica salvo direto aqui, sem precisar voltar
-- em totvs_orders toda vez -- é a chave usada pra aplicar o limite de 90
-- dias por cliente (um cliente com várias compras entregues na mesma
-- janela de 2 meses só pode receber uma pesquisa, ver enrollPendingCompraNps
-- em nps2Meses.ts).
create table if not exists compra_nps (
  order_id uuid primary key references totvs_orders(id) on delete cascade,
  client_id text not null,
  ghl_contact_id text not null,
  enviado_em timestamptz not null default now(),
  respondido_em timestamptz,
  score smallint check (score is null or (score >= 0 and score <= 10)),
  comentario text
);

-- Sustenta a checagem "esse cliente já recebeu uma pesquisa nos últimos 90
-- dias?" sem varrer a tabela inteira a cada rodada do sync.
create index if not exists compra_nps_client_enviado_idx on compra_nps (client_id, enviado_em);

alter table nps_detrator_status drop constraint if exists nps_detrator_status_origem_check;
alter table nps_detrator_status add constraint nps_detrator_status_origem_check
  check (origem in ('sac', 'montagem', 'assistencia_tecnica', 'entrega', 'compra'));
