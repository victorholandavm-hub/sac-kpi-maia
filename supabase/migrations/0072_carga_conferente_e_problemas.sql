-- Tela "Cargas" do SAC/admin: lista todas as cargas recentes (motorista,
-- conferente, transportadora) e permite anotar problemas encontrados,
-- por pedido/cliente dentro da carga.
--
-- conferente_codigo/conferente_nome: o campo já vem no payload do
-- GET /ai/deliveries (cargas[].conferente, fonte AC4) desde sempre, mas o
-- sync (src/lib/totvsSync.ts) nunca capturava -- só leitura, sincronizado
-- igual motorista_nome, sem digitação manual (ver 0043_totvs_deliveries.sql).
--
-- carga_problemas: anotação manual do time (SAC/admin), independente da
-- "ocorrência" que o próprio TOTVS já registra por carga/item (ZAH_OCORR) --
-- aquela é o que o motorista/sistema gravou lá, esta é o que o time
-- encontrar depois (reclamação do cliente, avaria notada na conferência
-- etc.). Uma linha por problema (a "quantidade" é só a contagem de linhas),
-- texto livre. Referencia totvs_delivery_cargas.id (não a carga como um
-- todo) porque uma carga física carrega vários pedidos/clientes diferentes
-- -- isso é o que amarra "com qual cliente" foi o problema.

alter table totvs_delivery_cargas add column if not exists conferente_codigo text;
alter table totvs_delivery_cargas add column if not exists conferente_nome text;

create table if not exists carga_problemas (
  id uuid primary key default gen_random_uuid(),
  carga_id uuid not null references totvs_delivery_cargas (id) on delete cascade,
  description text not null,
  reported_by_id uuid references profiles (id),
  reported_by_name text not null,
  reported_by_role text not null check (reported_by_role in ('sac', 'admin')),
  created_at timestamptz not null default now()
);

create index if not exists carga_problemas_carga_id_idx on carga_problemas (carga_id, created_at);

-- RLS: mesmo princípio das tabelas totvs_*/entrega_risco_* -- aplicação usa
-- client service-role (getSupabaseAdmin) pra todo acesso real, autorização
-- checada em código via src/lib/dal.ts. RLS aqui é só uma camada extra de
-- defesa caso a anon key seja usada direto.

alter table carga_problemas enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'carga_problemas' and policyname = 'carga_problemas_select_authenticated'
  ) then
    create policy carga_problemas_select_authenticated on carga_problemas
      for select to authenticated using (
        exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('sac', 'admin'))
      );
  end if;
end $$;
