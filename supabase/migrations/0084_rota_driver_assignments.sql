-- Motorista do dia por rota (praia/sul/centro) -- pedido do Victor
-- 17/08/2026: hoje o motorista é digitado chamado por chamado; a ideia é
-- marcar uma vez só "hoje, rota Praia = Fulano" e todo chamado daquela
-- rota/dia já puxar esse nome sozinho (ver setRotaDriverAssignment em
-- actions.ts e o auto-preenchimento em setSchedule). Override por chamado
-- continua existindo (DriverNameField) -- é o caminho pra mandar UM chamado
-- específico pra um motorista "extra", fora da rota do dia.

create table if not exists rota_driver_assignments (
  id uuid primary key default gen_random_uuid(),
  assignment_date date not null,
  rota text not null check (rota in ('praia', 'sul', 'centro')),
  driver_name text not null references drivers (name),
  updated_at timestamptz not null default now(),
  unique (assignment_date, rota)
);

alter table rota_driver_assignments enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'rota_driver_assignments' and policyname = 'rota_driver_assignments_select_authenticated'
  ) then
    create policy rota_driver_assignments_select_authenticated on rota_driver_assignments
      for select to authenticated using (true);
  end if;
end $$;
