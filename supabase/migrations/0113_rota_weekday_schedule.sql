-- Mudança de padrão semanal de rota COM data de início -- pedido do Victor
-- 08/09/2026: "aplique essa mudança mas só a partir do dia 14 de setembro.
-- As dessa semana estão mantidas". rota_weekday_config (dia da semana ->
-- rota) não tem noção de "a partir de quando" -- mudar direto ali valeria
-- retroativamente pra qualquer tela que reveja um intervalo de datas que
-- cruze a virada (ex.: getRotaWeekOverview, usado no painel "Motorista do
-- dia" com 14 dias de uma vez). Essa tabela guarda mudanças agendadas;
-- resolveRotaForDate (rotas.ts) escolhe, pra cada dia da semana, a entrada
-- agendada mais recente com effective_from <= a data pedida, caindo de
-- volta pro padrão de rota_weekday_config quando não existe nenhuma.
create table if not exists rota_weekday_schedule (
  id uuid primary key default gen_random_uuid(),
  weekday smallint not null check (weekday between 0 and 6),
  rota text,
  effective_from date not null,
  unique (weekday, effective_from)
);
