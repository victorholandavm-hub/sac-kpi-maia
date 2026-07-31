-- Encomenda passa a ter fornecedor: fábrica própria (Colchões ou Estofados)
-- ou fábrica externa (lista fixa em src/lib/fabricas.ts). Fábrica externa
-- pula a etapa de produção -- o CD assume o pedido desde "solicitado" (ver
-- requireEncomendaAction em src/lib/dal.ts).

-- 1. Catálogo das fábricas próprias -------------------------------------------

create table if not exists fabricas (
  id text primary key,
  nome text not null,
  ativo boolean not null default true
);

insert into fabricas (id, nome) values
  ('colchoes', 'Beds/Aiam Colchões'),
  ('estofados', 'Beds/Aiam Estofados')
on conflict (id) do nothing;

alter table fabricas enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'fabricas' and policyname = 'fabricas_select_authenticated'
  ) then
    create policy fabricas_select_authenticated on fabricas for select to authenticated using (true);
  end if;
end $$;

-- 2. Operador de fábrica passa a pertencer a uma fábrica específica -----------
-- Login continua por nome+PIN (fabricaAuth.ts não muda) -- só passa a
-- carregar a fábrica junto (ver EncomendaActor.fabricaId em encomendaAuth.ts).

alter table fabrica_operadores add column if not exists fabrica_id text references fabricas (id);

update fabrica_operadores set fabrica_id = 'colchoes' where fabrica_id is null;

insert into fabrica_operadores (name, fabrica_id) values ('João Maia', 'estofados')
on conflict (name) do update set fabrica_id = excluded.fabrica_id;

alter table fabrica_operadores alter column fabrica_id set not null;

-- 3. Fornecedor do pedido -------------------------------------------------------

alter table pedidos_encomenda add column if not exists fornecedor_tipo text not null default 'fabrica_interna'
  check (fornecedor_tipo in ('fabrica_interna', 'fabrica_externa'));
alter table pedidos_encomenda add column if not exists fabrica_id text references fabricas (id);
alter table pedidos_encomenda add column if not exists fornecedor_externo text;

-- Histórico todo veio da fábrica própria de colchões (única fábrica que
-- existia até aqui) -- backfill antes do check constraint abaixo, senão
-- pedidos antigos (fabrica_id nulo) violam a regra assim que ela existir.
update pedidos_encomenda set fabrica_id = 'colchoes' where fornecedor_tipo = 'fabrica_interna' and fabrica_id is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'pedidos_encomenda_fornecedor_check'
  ) then
    alter table pedidos_encomenda add constraint pedidos_encomenda_fornecedor_check check (
      (fornecedor_tipo = 'fabrica_interna' and fabrica_id is not null and fornecedor_externo is null)
      or
      (fornecedor_tipo = 'fabrica_externa' and fabrica_id is null and fornecedor_externo is not null)
    );
  end if;
end $$;
