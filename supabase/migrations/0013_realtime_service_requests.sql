-- Habilita Supabase Realtime (postgres_changes) para service_requests e
-- service_request_events, para a fila de solicitações atualizar sozinha no
-- navegador quando outra loja/pessoa cria ou muda algo, sem precisar de F5.
-- Rode este arquivo no SQL editor do projeto Supabase da Lojas Maia.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'service_requests'
  ) then
    alter publication supabase_realtime add table service_requests;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'service_request_events'
  ) then
    alter publication supabase_realtime add table service_request_events;
  end if;
end $$;
