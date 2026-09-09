-- Número original do chamado na planilha "Solicitação de peças"
-- (CH0001..CH1641) -- pedido do Victor 09/09/2026: "esse CH1641 é o numero
-- do chamado, tem que aparecer na tela resumida, nao crie outro numero de
-- ID para isso". O ticket_number de part_orders vem de uma sequência
-- COMPARTILHADA com service_requests (chamado_number_seq, ver
-- 0014_ticket_number.sql) -- não dá pra sobrescrever com o número da
-- planilha sem colidir com um chamado real já existente nessa faixa. Esse
-- campo novo guarda o número ORIGINAL só pra exibição nos pedidos
-- importados; pedidos criados de verdade pelo app (sem vínculo com a
-- planilha) continuam mostrando #ticket_number normalmente.
alter table part_orders add column if not exists external_reference text;

-- Backfill a partir do texto já salvo em notes na importação (0117/script
-- adhoc já apagado) -- extrai o "CH1641" e limpa esse trecho de notes,
-- sobrando só a observação de verdade (ex.: "VOLTA PRA CAIXA / OBS: MICHAEL").
update part_orders
set external_reference = substring(notes from 'Importado da planilha "Solicitação de peças" \((CH\d+)\)'),
    notes = nullif(trim(regexp_replace(notes, 'Importado da planilha "Solicitação de peças" \(CH\d+\)\.?\s*', '', 'g')), '')
where notes ilike 'Importado da planilha%';
