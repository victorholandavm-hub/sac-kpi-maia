-- Nova fase "Em observação" pra equipe técnica -- pedido do Victor
-- 24/08/2026: "preciso de uma nova fase alem de pendentes e concluido, que
-- é a fase 'em observação', onde a equipe tecnica, pode selecionar esse
-- status e abre um campo de texto livre e qiuando confirma ja vai para o
-- status em observação". Mesmo padrão de "mostruario" (0096) -- só que em
-- vez de exigir uma loja, exige uma nota de texto livre (por que está em
-- observação).
alter table service_request_items add column if not exists destino_observacao text;

alter table service_request_items drop constraint if exists service_request_items_destino_check;
alter table service_request_items add constraint service_request_items_destino_check
  check (
    destino is null
    or destino in ('fabrica', 'estoque', 'conserto', 'sem_condicoes', 'mostruario', 'pequena_avaria', 'peca_enviada', 'em_observacao')
  );

alter table service_request_items add constraint service_request_items_destino_observacao_completo
  check (destino is distinct from 'em_observacao' or destino_observacao is not null);
