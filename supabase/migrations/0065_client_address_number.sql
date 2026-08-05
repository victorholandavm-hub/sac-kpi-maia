-- Número e apartamento/bloco viravam parte do texto livre de client_address
-- (quando vinham) — sem obrigatoriedade nenhuma, então às vezes o motorista/
-- montador chegava no endereço sem saber o número ou se era apartamento.
-- Agora ficam em colunas próprias pra dar pra exigir separadamente (número
-- sempre obrigatório em montagem/desmontagem, apto só quando for o caso) e
-- exibir de forma mais clara em todas as telas.
alter table service_requests
  add column if not exists client_address_number text,
  add column if not exists client_is_apartment boolean not null default false,
  add column if not exists client_address_complement text;
