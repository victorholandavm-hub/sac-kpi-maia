-- Troca o login da loja de "PIN por loja" (qualquer um que soubesse o PIN de
-- uma loja entrava como ela) para "PIN por gerente": cada gerente tem seu
-- próprio nome + PIN — mesmo esquema de login do montador (nome + PIN de 4
-- dígitos). Um gerente pode gerenciar mais de uma loja, por isso a relação
-- gerente↔loja fica numa tabela separada (N:N), não uma coluna única.
-- Isso também é o que permite travar a criação de solicitação (ver
-- src/app/assistencia/actions.ts, createPublicRequest) às lojas do gerente
-- autenticado, em vez de deixar qualquer loja selecionável.

create table if not exists gerentes (
  name text primary key,
  pin_hash text,
  failed_pin_attempts integer not null default 0,
  pin_locked_until timestamptz
);

create table if not exists gerente_stores (
  gerente_name text not null references gerentes(name) on delete cascade,
  store_id text not null references stores(id) on delete cascade,
  primary key (gerente_name, store_id)
);

alter table stores drop column if exists pin_hash;
alter table stores drop column if exists failed_pin_attempts;
alter table stores drop column if exists pin_locked_until;
