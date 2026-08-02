-- Limite de tentativas de login por IP, complementar ao bloqueio por conta
-- (pin_locked_until) já existente em cada tabela de PIN. Bloqueio por conta
-- sozinho não impede alguém de tentar várias contas diferentes a partir do
-- mesmo IP; esse aqui fecha essa lacuna.
create table if not exists login_ip_rate_limit (
  ip text primary key,
  attempts integer not null default 0,
  window_start timestamptz not null default now()
);
