-- Ingestão do endpoint GET /ai/deliveries do Protheus (TOTVS), documentado em
-- api-totvs.yaml como "WSDeliveries" (operationId listDeliveries) -- ainda
-- não coberto em totvs.md/totvs2.md/totvs4.md/totvs6.md. Traz, por pedido de
-- venda, o array de cargas (uma por tentativa de entrega) com o status do
-- ciclo (ZAG_STATUS: Em Montagem..Encerrada) e o resultado da entrega quando
-- já tentada (ZAH_STATUS: Entregue/Entregue Parcial/Não Entregue/Cancelada).
-- Usado pela feature "Entregas em risco" do SAC (ver 0044_entregas_risco.sql)
-- pra avisar o time antes de um pedido atrasar.
--
-- Mesmo princípio de totvs_orders/totvs_clientes (0039_totvs_sync.sql): sem
-- FK física pra outras tabelas totvs_* -- os syncs rodam de forma
-- independente e um não pode falhar por causa do outro. O cruzamento com
-- totvs_orders (pra achar a data de emissão da NF a partir de
-- notaFiscal+serie de uma carga) é feito em código, em src/lib/entregasRisco.ts.
--
-- `first_seen_at` existe porque o payload do /ai/deliveries não expõe uma
-- data de venda/pedido explícita (só as cargas têm dtPrevisao/dtRetorno) --
-- é o fallback usado quando nenhuma carga do pedido tem nota fiscal ainda
-- (pedido "Em Montagem"/"Em Separação", o caso mais crítico pra avisar cedo).
-- Nunca é reescrito em upserts seguintes (omitido do payload de update).
--
-- `risk_trigger_at`/`risk_trigger_reason` são gravados pelo PRÓPRIO SYNC (não
-- pela leitura) quando ele detecta, comparando o snapshot anterior de cargas
-- com o novo, que uma carga que já estava agendada foi cancelada ou que o
-- pedido foi retirado dela -- ver detectDeliveryRiskTrigger() em
-- src/lib/totvsSync.ts. A leitura (src/lib/entregasRisco.ts) usa esse
-- timestamp pra decidir se o gatilho é mais recente que a última
-- classificação manual do SAC, e nesse caso sempre sobrepõe qualquer snooze.

create table if not exists totvs_deliveries (
  id uuid primary key default gen_random_uuid(),
  pedido text not null,
  filial_venda text not null,
  loja text,
  client_id text,
  client_loja text,
  client_name text,
  client_cpf_cnpj text,
  client_neighborhood text,
  client_city text,
  client_state text,
  status_atual text,
  status_atual_codigo text,
  total_cargas integer,
  risk_trigger_at timestamptz,
  risk_trigger_reason text,
  first_seen_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'totvs_deliveries_pedido_filial_venda_key'
  ) then
    alter table totvs_deliveries add constraint totvs_deliveries_pedido_filial_venda_key unique (pedido, filial_venda);
  end if;
end $$;

create index if not exists totvs_deliveries_status_atual_idx on totvs_deliveries (status_atual);
create index if not exists totvs_deliveries_client_cpf_cnpj_idx on totvs_deliveries (client_cpf_cnpj);

drop trigger if exists totvs_deliveries_set_updated_at on totvs_deliveries;
create trigger totvs_deliveries_set_updated_at
  before update on totvs_deliveries
  for each row execute function set_updated_at();

create table if not exists totvs_delivery_cargas (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references totvs_deliveries (id) on delete cascade,
  carga text not null,
  dt_previsao date,
  tentativa integer,
  tipo_entrega text check (tipo_entrega in ('Entrega', 'Retirada', 'Express')),
  status_carga text,
  status_carga_codigo text,
  status_entrega text,
  status_entrega_codigo text,
  status_origem text check (status_origem in ('CARGA', 'ENTREGA')),
  motorista_codigo text,
  motorista_nome text,
  transportadora text,
  veiculo text,
  regiao text,
  nota_fiscal text,
  serie text,
  dt_retorno date,
  hr_retorno text,
  ocorrencia_codigo text,
  ocorrencia_descricao text,
  ocorrencia_categoria text,
  ocorrencia_nivel text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'totvs_delivery_cargas_delivery_id_carga_key'
  ) then
    alter table totvs_delivery_cargas add constraint totvs_delivery_cargas_delivery_id_carga_key unique (delivery_id, carga);
  end if;
end $$;

create index if not exists totvs_delivery_cargas_delivery_id_idx on totvs_delivery_cargas (delivery_id, tentativa);
create index if not exists totvs_delivery_cargas_nota_fiscal_serie_idx on totvs_delivery_cargas (nota_fiscal, serie);
create index if not exists totvs_delivery_cargas_dt_previsao_idx on totvs_delivery_cargas (dt_previsao);

drop trigger if exists totvs_delivery_cargas_set_updated_at on totvs_delivery_cargas;
create trigger totvs_delivery_cargas_set_updated_at
  before update on totvs_delivery_cargas
  for each row execute function set_updated_at();

-- RLS: aplicação usa o client service-role (getSupabaseAdmin) pra todo acesso
-- real (sync e leitura da tela /assistencia/sac/entregas-risco), com
-- autorização checada em código via src/lib/dal.ts. RLS aqui é só uma camada
-- extra de defesa caso a anon key seja usada direto.

alter table totvs_deliveries enable row level security;
alter table totvs_delivery_cargas enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'totvs_deliveries' and policyname = 'totvs_deliveries_select_authenticated'
  ) then
    create policy totvs_deliveries_select_authenticated on totvs_deliveries
      for select to authenticated using (
        exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('sac', 'admin'))
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'totvs_delivery_cargas' and policyname = 'totvs_delivery_cargas_select_authenticated'
  ) then
    create policy totvs_delivery_cargas_select_authenticated on totvs_delivery_cargas
      for select to authenticated using (
        exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('sac', 'admin'))
      );
  end if;
end $$;
