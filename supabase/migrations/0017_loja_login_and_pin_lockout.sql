-- Login do gerente de loja por nome da loja + PIN de 4 dígitos (mesmo esquema
-- do montador), pra fechar a brecha em que qualquer visitante de
-- /assistencia/loja conseguia propor prazo em chamados de QUALQUER loja, sem
-- nenhuma verificação. Também adiciona bloqueio por tentativas erradas de PIN
-- (montador e loja), já que um PIN de 4 dígitos sem limite de tentativas é
-- adivinhável por força bruta.

alter table stores add column if not exists pin_hash text;
alter table stores add column if not exists failed_pin_attempts integer not null default 0;
alter table stores add column if not exists pin_locked_until timestamptz;

alter table assemblers add column if not exists failed_pin_attempts integer not null default 0;
alter table assemblers add column if not exists pin_locked_until timestamptz;
