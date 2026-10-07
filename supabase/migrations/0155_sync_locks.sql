-- Trava de execução única para quem chama a API do Protheus (07/10/2026).
-- Achado do Victor: o sync rodava ao mesmo tempo da tarefa agendada no PC
-- (a cada 30 min), do GitHub Actions (a cada 2h) e do backfill do NPS em
-- /api/sync. A API do Protheus aguenta no máximo 2 conexões, e passar disso
-- trava o caixa das lojas.
--
-- É um "aluguel" com prazo, não pg_advisory_lock: o supabase-js passa pelo
-- PostgREST, e cada chamada usa uma conexão diferente, então um advisory
-- lock de sessão não sobreviveria entre as chamadas. Se o processo morrer
-- (deploy, pm2 restart, Ctrl+C), a trava expira sozinha.
create table if not exists sync_locks (
  job text primary key,
  dono uuid not null,
  origem text not null,
  adquirida_em timestamptz not null default now(),
  expira_em timestamptz not null
);

alter table sync_locks enable row level security;

grant select, insert, update, delete on public.sync_locks to service_role;

-- Só toma a trava se ela não existir ou já tiver expirado. Quando não
-- consegue, devolve quem está com ela e desde quando.
create or replace function adquirir_trava(p_job text, p_dono uuid, p_origem text, p_ttl_segundos integer)
returns table (adquirida boolean, origem text, desde timestamptz)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  insert into sync_locks as l (job, dono, origem, adquirida_em, expira_em)
  values (p_job, p_dono, p_origem, now(), now() + make_interval(secs => p_ttl_segundos))
  on conflict (job) do update
    set dono = excluded.dono,
        origem = excluded.origem,
        adquirida_em = excluded.adquirida_em,
        expira_em = excluded.expira_em
    where l.expira_em < now();

  if found then
    return query select true, p_origem, now();
  else
    return query select false, l.origem, l.adquirida_em from sync_locks l where l.job = p_job;
  end if;
end;
$$;

-- Devolve false se a trava passou para outro dono (expirou e foi tomada).
create or replace function renovar_trava(p_job text, p_dono uuid, p_ttl_segundos integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update sync_locks
     set expira_em = now() + make_interval(secs => p_ttl_segundos)
   where job = p_job and dono = p_dono;
  return found;
end;
$$;

create or replace function liberar_trava(p_job text, p_dono uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from sync_locks where job = p_job and dono = p_dono;
end;
$$;

-- security definer é executável por PUBLIC por padrão: fecha para todo mundo
-- e libera só para o service_role (getSupabaseAdmin -> .rpc()).
revoke execute on function adquirir_trava(text, uuid, text, integer) from public, anon, authenticated;
revoke execute on function renovar_trava(text, uuid, integer) from public, anon, authenticated;
revoke execute on function liberar_trava(text, uuid) from public, anon, authenticated;
grant execute on function adquirir_trava(text, uuid, text, integer) to service_role;
grant execute on function renovar_trava(text, uuid, integer) to service_role;
grant execute on function liberar_trava(text, uuid) to service_role;
