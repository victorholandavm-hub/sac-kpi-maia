-- Fotos anexadas a um chamado (montagem, desmontagem, vistoria de produto
-- avariado etc.) — cobre a documentação visual que faltava, especialmente
-- pra vistoria (prova do estado do móvel na casa do cliente). Upload sempre
-- via client service-role (montador ou equipe assistência autenticados na
-- aplicação); RLS aqui é só camada extra de defesa, como no resto do banco.

create table if not exists service_request_photos (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references service_requests (id) on delete cascade,
  storage_path text not null,
  uploaded_by text,
  caption text,
  created_at timestamptz not null default now()
);

create index if not exists service_request_photos_request_idx on service_request_photos (request_id);

alter table service_request_photos enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'service_request_photos' and policyname = 'service_request_photos_select'
  ) then
    create policy service_request_photos_select on service_request_photos
      for select to authenticated using (
        exists (
          select 1 from service_requests r
          join profiles p on p.id = auth.uid()
          where r.id = service_request_photos.request_id
            and (p.role in ('assistencia', 'admin') or (p.role = 'gerente' and p.store_id = r.store_id))
        )
      );
  end if;
end $$;

-- Bucket privado (sem acesso público direto) — as fotos são servidas via URL
-- assinada gerada pela aplicação, nunca por link público permanente.
insert into storage.buckets (id, name, public)
values ('service-request-photos', 'service-request-photos', false)
on conflict (id) do nothing;
