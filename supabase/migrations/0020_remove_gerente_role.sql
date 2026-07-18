-- Remove o papel "gerente" (login por e-mail/senha via Supabase Auth), que
-- nunca chegou a ser usado de verdade — nenhuma conta profiles.role='gerente'
-- existe hoje. O acesso do gerente de loja acontece só pelo login por PIN em
-- /assistencia/loja (src/lib/lojaAuth.ts), então esse papel ficou órfão.

do $$
declare
  r record;
begin
  for r in (
    select conname from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%gerente%'
  ) loop
    execute format('alter table profiles drop constraint %I', r.conname);
  end loop;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_role_check'
  ) then
    alter table profiles add constraint profiles_role_check check (role in ('assistencia', 'admin'));
  end if;
end $$;
