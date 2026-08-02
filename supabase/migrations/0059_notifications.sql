-- Notificações in-app: alertas de admin (erro/bug) e atualizações pra quem
-- usa o sistema (status/prazo de solicitação ou pedido). Destinatário é por
-- papel compartilhado (loja/fábrica/CD/admin), não por pessoa -- a maioria
-- desses papéis loga por PIN compartilhado, sem conta individual (ver
-- gerentes/caixas/fabrica_operadores). Sem coluna de "lido": isso vira
-- estado local por navegador (mesmo padrão de NewSinceBadge), já que não
-- tem como saber QUEM leu numa sessão compartilhada.

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_kind text not null,
  recipient_key text,
  type text not null,
  title text not null,
  message text,
  link text,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_idx
  on notifications (recipient_kind, recipient_key, created_at desc);

alter table notifications enable row level security;

drop policy if exists notifications_select_authenticated on notifications;
create policy notifications_select_authenticated on notifications
  for select to authenticated using (true);
