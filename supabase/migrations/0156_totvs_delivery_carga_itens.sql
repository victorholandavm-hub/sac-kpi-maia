-- Itens de cada pedido x carga (07/10/2026), para a tela de KPIs logísticos
-- (volume P/M/G por carga -- ver lojas-maia-integracao/apis/logistica-v1/
-- kpis-logistica.md). O /rest/ai/deliveries já devolve cargas[].itens (ZAI)
-- em toda chamada; até aqui o sync descartava. Gravar não custa nenhuma
-- chamada a mais ao Protheus.
--
-- on delete cascade: quando o sync remove uma carga que saiu do pedido
-- (upsertDelivery, staleCargaCodes), os itens dela vão junto.
create table if not exists totvs_delivery_carga_itens (
  id uuid primary key default gen_random_uuid(),
  delivery_carga_id uuid not null references totvs_delivery_cargas (id) on delete cascade,
  item text not null,
  produto text not null,
  descricao text,
  quantidade numeric(14,4) not null default 0,
  status_codigo text,
  ocorrencia_codigo text,
  ocorrencia_descricao text,
  updated_at timestamptz not null default now(),
  unique (delivery_carga_id, item)
);

create index if not exists totvs_delivery_carga_itens_produto_idx on totvs_delivery_carga_itens (produto);

alter table totvs_delivery_carga_itens enable row level security;

-- Só o service_role (sync e RPCs). Explícito por causa do fim do grant
-- automático do Data API em tabelas novas (aviso do Supabase, 23/09/2026).
grant select, insert, update, delete on public.totvs_delivery_carga_itens to service_role;
