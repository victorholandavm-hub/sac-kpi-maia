-- Equipe técnica (portal próprio, login por nome+PIN igual a montador/
-- motorista): quem recebe o motorista na volta da rota, confere o produto
-- recolhido e decide o destino (ver 0082_item_destino.sql). Papel novo,
-- pedido do Victor 17/08/2026 -- não existe hoje nenhum papel parecido:
-- login por nome+PIN compartilhado (não Supabase Auth, sem conta
-- individual), mesmo padrão de assemblers/drivers.

create table if not exists tecnicos (
  name text primary key,
  pin_hash text,
  failed_pin_attempts integer not null default 0,
  pin_locked_until timestamptz
);

alter table tecnicos enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'tecnicos' and policyname = 'tecnicos_select_authenticated'
  ) then
    create policy tecnicos_select_authenticated on tecnicos for select to authenticated using (true);
  end if;
end $$;
