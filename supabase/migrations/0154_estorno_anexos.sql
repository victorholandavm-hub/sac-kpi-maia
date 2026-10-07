-- Vários comprovantes por estorno, dos dois lados -- pedido do Victor
-- 07/10/2026: "seja possível adicionar mais de um comprovante, tanto de
-- quem solicita quanto de quem é do financeiro". Tabela aditiva: as colunas
-- antigas (anexo_solicitacao_path, anexo_comprovante_path) continuam
-- recebendo o primeiro arquivo de cada lado -- satisfaz a NOT NULL que já
-- existia em anexo_solicitacao_path e não quebra nada que ainda lê direto
-- delas. A lista completa (1 ou mais arquivos) vem daqui.
create table estorno_anexos (
  id uuid primary key default gen_random_uuid(),
  estorno_id uuid not null references estorno_requests(id) on delete cascade,
  kind text not null check (kind in ('solicitacao', 'comprovante')),
  path text not null,
  uploaded_by text,
  created_at timestamptz not null default now()
);

create index idx_estorno_anexos_estorno on estorno_anexos (estorno_id, kind);

alter table estorno_anexos enable row level security;
create policy estorno_anexos_select_authenticated on estorno_anexos for select to authenticated using (true);

-- Backfill: cada solicitação existente já tinha exatamente 1 arquivo de
-- cada lado (quando tinha) -- vira a primeira linha da lista nova.
insert into estorno_anexos (estorno_id, kind, path, uploaded_by, created_at)
select id, 'solicitacao', anexo_solicitacao_path, requester_name, created_at
from estorno_requests;

insert into estorno_anexos (estorno_id, kind, path, uploaded_by, created_at)
select id, 'comprovante', anexo_comprovante_path, concluido_por, coalesce(concluido_em, created_at)
from estorno_requests
where anexo_comprovante_path is not null;
