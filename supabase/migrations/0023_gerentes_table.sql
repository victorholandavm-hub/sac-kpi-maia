-- Troca o login da loja de "PIN por loja" (qualquer um que soubesse o PIN de
-- uma loja entrava como ela) para "PIN por gerente": cada gerente tem seu
-- próprio nome + PIN, vinculado a uma loja específica — mesmo esquema de
-- login do montador (nome + PIN de 4 dígitos), só que com uma loja atrelada.
-- Isso também é o que permite travar a criação de solicitação (ver
-- src/app/assistencia/actions.ts, createPublicRequest) à loja do gerente
-- autenticado, em vez de deixar qualquer loja selecionável.

create table if not exists gerentes (
  name text primary key,
  store_id text not null references stores(id),
  pin_hash text,
  failed_pin_attempts integer not null default 0,
  pin_locked_until timestamptz
);

alter table stores drop column if exists pin_hash;
alter table stores drop column if exists failed_pin_attempts;
alter table stores drop column if exists pin_locked_until;
