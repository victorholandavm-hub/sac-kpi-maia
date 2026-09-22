-- NPS "Pós-entrega" -- pedido do Victor 22/09/2026: pesquisa sobre a
-- entrega ORIGINAL da compra (o caminhão leva o móvel pela primeira vez),
-- não um chamado de assistência (esse já tem service_request_nps, tipo
-- 'montagem'/'assistencia_tecnica'). Mesmo espírito de compra_nps
-- (0115_compra_nps.sql) -- por PEDIDO de venda (totvs_orders), fonte
-- totvs_delivery_cargas -- só que com uma janela bem mais curta (dias
-- depois da entrega, não meses -- ver TARGET_DAYS_AGO em entregaNps.ts).
-- "Pós-entrega" já existia como valor de `origem` em nps_detrator_status
-- (0114_nps_entrega_tipo.sql) e como `tipo` em service_request_nps -- essa
-- 2ª parte nunca chegou a ser usada de verdade (histórico do projeto:
-- tentativa anterior classificava por tipo de chamado, revertida em
-- 22/09/2026 quando Victor esclareceu que "entrega" é sobre a compra, não
-- sobre um chamado) -- fica como estava (constraint permissiva, sem dado
-- nenhum lá pra esse tipo), sem necessidade de migração de limpeza.
create table if not exists entrega_nps (
  order_id uuid primary key references totvs_orders(id) on delete cascade,
  client_id text not null,
  ghl_contact_id text not null,
  enviado_em timestamptz not null default now(),
  respondido_em timestamptz,
  score smallint check (score is null or (score >= 0 and score <= 10)),
  comentario text
);

create index if not exists entrega_nps_pendente_idx
  on entrega_nps (enviado_em)
  where respondido_em is null;
