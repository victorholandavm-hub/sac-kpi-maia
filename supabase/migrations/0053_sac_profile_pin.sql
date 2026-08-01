-- SAC deixa de usar o login compartilhado do time (e-mail/senha único +
-- "Quem é você?") e passa a logar direto por nome+PIN, mesmo padrão de
-- montador/motorista/CD/fábrica (ver src/app/assistencia/actions.ts,
-- sacPinSignIn). PIN fica na própria linha de profiles -- são as mesmas
-- contas Supabase Auth já existentes, só ganham um segundo portão de
-- entrada, não uma tabela separada como fabrica_operadores.

alter table profiles add column if not exists pin_hash text;
alter table profiles add column if not exists failed_pin_attempts integer not null default 0;
alter table profiles add column if not exists pin_locked_until timestamptz;
