-- Fecha lacunas de RLS achadas em auditoria: gerentes/gerente_stores (0023)
-- ficaram de fora da política que toda outra tabela de PIN recebeu desde a
-- própria criação (cd_operadores, fabrica_operadores, caixas, vendedores,
-- drivers, assemblers -- ver 0028/0025/0030/0031/0006). Sem RLS, a REST API
-- do Supabase expõe a tabela por padrão pra quem tiver a anon key (pública,
-- vai no bundle do client) -- o app em si só acessa via service role, mas o
-- buraco existe direto contra o Supabase.
--
-- login_ip_rate_limit (0056) e public_request_submissions (0021) também
-- ficaram sem RLS -- não guardam pin_hash, mas são só bookkeeping interno
-- (IP + contagem de tentativa), sem motivo de nenhum client autenticado
-- precisar ler direto; seguem o padrão mais restritivo já usado em
-- totvs_sync_state (RLS ligado, sem nenhuma policy de select).

alter table gerentes enable row level security;
alter table gerente_stores enable row level security;
alter table login_ip_rate_limit enable row level security;
alter table public_request_submissions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'gerentes' and policyname = 'gerentes_select_authenticated'
  ) then
    create policy gerentes_select_authenticated on gerentes for select to authenticated using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'gerente_stores' and policyname = 'gerente_stores_select_authenticated'
  ) then
    create policy gerente_stores_select_authenticated on gerente_stores for select to authenticated using (true);
  end if;
end $$;
