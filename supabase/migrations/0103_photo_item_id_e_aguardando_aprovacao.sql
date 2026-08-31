-- Foto por item + aprovação da loja antes de "concluída" -- pedido do
-- Victor 31/08/2026: "preciso que seja obrigatório que o montador coloque
-- foto de cada item montado antes de colocar como montagem concluida...
-- a partir de agora, o gerente da loja vai precisar aprovar essa
-- conclusão, e precisa ter a opção de colocar quais produtos nao foram
-- montados/desmontados".
--
-- item_id: null continua significando "foto do chamado inteiro" (uso
-- atual -- comprovante de entrega do motorista, observações gerais,
-- chamado sem item cadastrado). Preenchida = foto de um item específico
-- (novo, montador/desmontador).
alter table service_request_photos
  add column if not exists item_id uuid references service_request_items(id) on delete cascade;

create index if not exists service_request_photos_item_id_idx on service_request_photos(item_id);

-- Novo status "aguardando_aprovacao" -- só entra aqui montagem/desmontagem
-- (inclusive combo) depois que o montador marca como concluído; só vira
-- "concluida" de verdade quando o gerente da loja aprova
-- (lojaApproveMontagemConclusion, loja-actions.ts). `status` TEM check
-- constraint (service_requests_status_check, lista fechada de valores) --
-- precisa trocar a constraint, não é texto livre.
alter table service_requests drop constraint if exists service_requests_status_check;
alter table service_requests add constraint service_requests_status_check
  check (status = any (array['aberta', 'em_contato', 'em_andamento', 'aguardando_aprovacao', 'remarcar', 'concluida', 'cancelada']));
