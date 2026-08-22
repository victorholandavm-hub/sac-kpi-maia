-- Pedido do Victor 21/08/2026: "quando a notificação de assistência quando
-- o solicitante for colocar o erro e selecionar 'outro' ele precisar
-- digitar o que houve exatamente". Mesmo padrão de erro_conferencia
-- (causa_carga/causa_conferente) e erro_motorista (causa_carga) --
-- "Outro" ganha o próprio campo obrigatório em vez de depender só do
-- "Motivo" genérico (que já é obrigatório sempre, mas não é específico
-- da causa raiz).
alter table service_requests add column if not exists causa_raiz_detalhe text;

-- Backfill: 5 chamados já tinham causa_raiz='outro' antes desse campo
-- existir (confirmado antes de escrever essa migration -- #4792, #4785,
-- #4775, #4756, #4755), então a constraint abaixo quebraria neles se
-- causa_raiz_detalhe ficasse null. "Motivo" (reason) já era obrigatório
-- desde sempre e, nesses 5 casos, já descreve o que aconteceu -- copia
-- pra lá em vez de inventar um texto genérico.
update service_requests
set causa_raiz_detalhe = reason
where causa_raiz = 'outro' and causa_raiz_detalhe is null;

-- Mesma defesa extra de 0077/0080 -- a validação de verdade é em
-- createSacRequest, isso só garante que nenhum caminho novo esqueça.
alter table service_requests drop constraint if exists service_requests_causa_completa;
alter table service_requests add constraint service_requests_causa_completa check (
  (causa_raiz is distinct from 'erro_conferencia' or (causa_carga is not null and causa_conferente is not null))
  and
  (causa_raiz is distinct from 'erro_motorista' or (causa_carga is not null and driver_name is not null))
  and
  (causa_raiz is distinct from 'outro' or causa_raiz_detalhe is not null)
);
