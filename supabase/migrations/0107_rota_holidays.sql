-- Feriados/dias sem rota -- pedido do Victor 05/09/2026: "nos domingos,
-- coloque 'sem rota disponivel hoje' e que eu tenha a opção de colocar
-- isso em qualquer dia, só eu, para um feriado". Domingo já não tem rota
-- por padrão (rota_weekday_config, weekday=0 -- ver rotas.ts), mas não
-- existia como travar um dia ESPECÍFICO independente do padrão semanal
-- daquele dia da semana (ex.: um feriado que cai numa terça-feira comum).
-- Só admin mexe nisso (ver setRotaWeekday, mesmo padrão de acesso já
-- usado pra "Rotas de entrega" em /assistencia/admin).
create table if not exists rota_holidays (
  date date primary key,
  note text,
  created_at timestamptz not null default now()
);
