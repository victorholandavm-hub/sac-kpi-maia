-- Novos destinos pra equipe técnica -- pedido do Victor 21/08/2026:
-- "enviado para mostruario" (que teriam que selecionar a loja pra qual
-- foi enviada), "pequena avaria" e "peça enviada".
--
-- "mostruario" precisa saber pra QUAL loja foi enviado -- mesmo padrão de
-- erro_conferencia/erro_motorista (causa_raiz) e de "outro"
-- (0094_causa_raiz_outro_detalhe.sql): um destino específico ganha o
-- próprio campo obrigatório em vez de um texto livre genérico.
alter table service_request_items add column if not exists destino_loja_id text references stores(id);

alter table service_request_items drop constraint if exists service_request_items_destino_check;
alter table service_request_items add constraint service_request_items_destino_check
  check (destino is null or destino in ('fabrica', 'estoque', 'conserto', 'sem_condicoes', 'mostruario', 'pequena_avaria', 'peca_enviada'));

-- Defesa extra (a validação de verdade é em setItemDestino) -- garante que
-- "mostruario" nunca fica sem destino_loja_id, mesmo padrão de
-- service_requests_causa_completa.
alter table service_request_items drop constraint if exists service_request_items_destino_mostruario_completo;
alter table service_request_items add constraint service_request_items_destino_mostruario_completo
  check (destino is distinct from 'mostruario' or destino_loja_id is not null);
