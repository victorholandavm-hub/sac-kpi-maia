-- Destino do produto recolhido pelo motorista (fábrica/estoque/conserto/
-- sem condições) -- decisão da equipe técnica (ver 0081_tecnicos.sql),
-- registrada por item (não pelo chamado inteiro): uma troca de produto
-- pode voltar com mais de um item, cada um com destino diferente.

alter table service_request_items add column if not exists destino text;
alter table service_request_items add column if not exists destino_definido_por text;
alter table service_request_items add column if not exists destino_definido_em timestamptz;

alter table service_request_items drop constraint if exists service_request_items_destino_check;
alter table service_request_items add constraint service_request_items_destino_check
  check (destino is null or destino in ('fabrica', 'estoque', 'conserto', 'sem_condicoes'));
