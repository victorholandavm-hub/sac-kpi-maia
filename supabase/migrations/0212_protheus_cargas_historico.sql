-- Quem fez cada passo das cargas do Protheus -- Victor 27/10/2026 ("não tem
-- como recuperar esses dados de conferência do Protheus?"). A API mandava
-- cargas[].conferente só com o código (ZAG_CONFER, consulta AC4) e o nome vazio;
-- o Pedro exportou da ZAG/ZAD/AC4 (~/importar/zad_conferentes_2025_20261024.csv,
-- 13/10/2025 a 24/10/2026). A ZAG não guarda a hora da conferência: a mais
-- próxima é a da liberação.
create table if not exists protheus_cargas_historico (
  carga text primary key,
  status text,
  tipo text,
  incluida_em date,
  incluida_por text,
  conferente_codigo text,
  conferente_nome text,
  liberada_em date,
  liberada_hora text,
  motorista_nome text,
  placa text,
  separacao_em date,
  separacao_hora text,
  separacao_por text,
  faturada_em date,
  faturada_hora text,
  faturada_por text,
  em_rota_em date,
  em_rota_hora text
);

alter table protheus_cargas_historico enable row level security;
