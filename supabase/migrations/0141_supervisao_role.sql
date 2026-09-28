-- Adiciona "supervisao" (papel de leitura -- Estornos, Notificação de
-- Assistência, Visitas, Reclamações -- ver dal.ts/Role, pedido do Victor
-- 28/09/2026, conta da Akyla Thais) à check constraint de profiles.role.
-- Mesmo padrão idempotente de 0020/0025/0027/0028 (drop se existir, recria
-- com a lista completa).
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'profiles_role_check') then
    alter table profiles drop constraint profiles_role_check;
  end if;
  alter table profiles add constraint profiles_role_check
    check (role in ('assistencia', 'admin', 'sac', 'supervisao'));
end $$;
