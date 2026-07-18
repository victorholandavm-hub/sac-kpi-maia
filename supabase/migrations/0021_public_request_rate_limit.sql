-- Limite de envios por IP no formulário público de solicitação
-- (/assistencia/solicitar, sem login nenhum) — sem isso, qualquer visitante
-- consegue inundar a fila com solicitações falsas sem limite algum.

create table if not exists public_request_submissions (
  id uuid primary key default gen_random_uuid(),
  ip_address text not null,
  created_at timestamptz not null default now()
);

create index if not exists public_request_submissions_ip_time_idx
  on public_request_submissions (ip_address, created_at);
