-- Atribuição de um pedido em risco a um atendente do SAC (pedido do usuário:
-- "tem que ser possível atribuir o cliente a um atendente"). Fica na mesma
-- linha de entrega_risco_status (0044_entregas_risco.sql), mas é um campo
-- independente da classificação (nota + reavaliar_em) -- dá pra atribuir sem
-- nunca ter classificado, por isso classified_by_name/classified_by_role
-- viram opcionais aqui: uma linha pode existir só por causa da atribuição.

alter table entrega_risco_status alter column classified_by_name drop not null;
alter table entrega_risco_status alter column classified_by_role drop not null;

alter table entrega_risco_status add column if not exists assigned_to_id uuid references profiles (id) on delete set null;
alter table entrega_risco_status add column if not exists assigned_to_name text;
alter table entrega_risco_status add column if not exists assigned_at timestamptz;

create index if not exists entrega_risco_status_assigned_to_id_idx on entrega_risco_status (assigned_to_id);

-- Adiciona 'atribuido' ao check de event_type sem depender do nome
-- autogerado da constraint original (achado por definição, não por nome fixo).
do $$
declare
  r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'entrega_risco_events'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%event_type%'
  loop
    execute format('alter table entrega_risco_events drop constraint %I', r.conname);
  end loop;
end $$;

alter table entrega_risco_events add constraint entrega_risco_events_event_type_check
  check (event_type in ('classificado', 'reaberto_por_cancelamento', 'atribuido'));
