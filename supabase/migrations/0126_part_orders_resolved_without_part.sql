-- Diferenciar o CASO do cliente da PEÇA em si -- pedido do Victor
-- 14/09/2026: "às vezes consegue a peça por outros meios, antes da peça
-- solicitada à fábrica chegar... e envia para o cliente e encerra o caso
-- dele e só depois a peça chega... e essa peça... volta pro estoque, visto
-- que o problema do cliente já foi resolvido". E, ao ser perguntado como
-- imaginava marcar isso: "preciso que haja dentro da solicitação a
-- diferenciação entre a solicitação do cliente e a peça ligada a ele. Pois
-- o caso fica encerrado, mas nós ainda estamos aguardando a peça".
--
-- Antes disso, `status` conflava as duas coisas: "o caso do cliente está
-- resolvido" e "a peça chegou/foi enviada" eram o mesmo campo -- não dava
-- pra fechar o caso do cliente (resolvido por outro meio) e continuar
-- rastreando a peça, que ainda está a caminho do fornecedor, separadamente.
--
-- `resolved_without_part_at`/`resolved_without_part_by`: quando
-- preenchidos, o CASO do cliente já foi resolvido por outro meio, sem
-- esperar esta peça específica -- o pedido de peça em si CONTINUA seu
-- fluxo normal (aguardando_resposta/aguardando_peca -> peca_recebida) até
-- a peça chegar de verdade. Independente de status de propósito (mesmo
-- espírito de updatePartArrivedAt/updateSentToClientAt, migration 0125) --
-- só registra o fato, sem mexer no fluxo de chegada. Ver
-- markResolvedWithoutPart/unmarkResolvedWithoutPart (pecas-actions.ts).
--
-- `devolvida_ao_estoque`: status novo, terminal (igual encerrado/
-- cancelada) -- o desfecho da peça quando ela chega DEPOIS do caso já ter
-- sido resolvido por outro meio: em vez de "enviada_ao_cliente" (não tem
-- mais cliente esperando por ela), ela volta pro estoque. Ver
-- updatePartOrderDelivery (outcome "devolvida_estoque") em
-- pecas-actions.ts.
alter table part_orders add column resolved_without_part_at timestamptz;
alter table part_orders add column resolved_without_part_by text;

alter table part_orders drop constraint if exists part_orders_status_check;
alter table part_orders add constraint part_orders_status_check
  check (status in ('aguardando_peca', 'aguardando_resposta', 'peca_recebida', 'enviada_ao_cliente', 'encerrado', 'cancelada', 'devolvida_ao_estoque'));
