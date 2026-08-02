-- Histórico das rodadas de sincronização (TOTVS, GHL, backup) -- hoje a
-- única forma de saber que um desses parou de funcionar é alguém notar na
-- prática (foi o que aconteceu com o TOTVS: 2 dias quebrado até alguém
-- perceber que busca de cliente/produto tinha parado). Uma linha por rodada
-- dá pra tela de admin mostrar "última vez: há Xh, ok/erro" sem depender de
-- ninguém olhar log manualmente.

create table if not exists sync_runs (
  id uuid primary key default gen_random_uuid(),
  job text not null,
  ok boolean not null,
  summary jsonb,
  errors text[] not null default '{}',
  ran_at timestamptz not null default now()
);

create index if not exists sync_runs_job_ran_at_idx on sync_runs (job, ran_at desc);

alter table sync_runs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'sync_runs' and policyname = 'sync_runs_select_authenticated'
  ) then
    create policy sync_runs_select_authenticated on sync_runs for select to authenticated using (true);
  end if;
end $$;
