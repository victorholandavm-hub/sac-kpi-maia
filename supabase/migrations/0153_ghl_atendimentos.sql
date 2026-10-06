-- Atendimentos do SAC nas subcontas GHL Lojas Maia e GHL Líder (pedido do Victor
-- 06/10/2026). Um registro por conversa atribuída a um atendente do SAC, só com
-- quantidade e tempo de resposta -- nenhum texto de mensagem é guardado.
create table if not exists ghl_atendimentos (
  id uuid primary key default gen_random_uuid(),
  subconta text not null check (subconta in ('lojas_maia', 'lider')),
  ghl_conversation_id text not null unique,
  atendente_user_id text not null,
  atendente_nome text not null,
  aberta_em timestamptz not null,
  primeira_resposta_min numeric(10,1),
  atualizado_em timestamptz not null default now()
);

create index if not exists ghl_atendimentos_subconta_idx on ghl_atendimentos (subconta, aberta_em);

alter table ghl_atendimentos enable row level security;
