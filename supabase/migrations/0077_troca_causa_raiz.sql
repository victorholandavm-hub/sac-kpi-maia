-- Rastreabilidade de troca de produto (SAC) por causa raiz -- antes só
-- existia o campo "Motivo" (texto livre), sem forçar registrar qual carga e
-- qual conferente estavam por trás de uma troca por erro do CD. Pedido do
-- usuário em 2026-08-13: "toda e qualquer troca que foi erro do CD, antes de
-- trocar eu preciso saber o que aconteceu -- qual carga, qual conferente".
--
-- causa_conferente é texto livre de propósito (não FK/lookup): confirmado em
-- 2026-08-11 que o TOTVS não entrega o vínculo carga→conferente (ver
-- src/lib/cargas.ts) -- quem cria a troca digita o nome de quem souber.
alter table service_requests add column if not exists causa_raiz text
  check (causa_raiz is null or causa_raiz in (
    'erro_cd', 'erro_loja', 'erro_vendedor', 'avaria_transporte', 'defeito_fabricacao', 'solicitacao_cliente', 'outro'
  ));
alter table service_requests add column if not exists causa_carga text;
alter table service_requests add column if not exists causa_conferente text;

-- Defesa extra (a validação de verdade é em createSacRequest) -- garante que
-- uma troca marcada como erro do CD nunca fica sem carga/conferente
-- registrados, mesmo se algum caminho novo esquecer de validar.
-- "add constraint if not exists" não existe no Postgres -- mesmo padrão de
-- checagem manual via catálogo que o projeto já usa pra policies (ver 0072).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'service_requests_causa_cd_completa'
  ) then
    alter table service_requests add constraint service_requests_causa_cd_completa
      check (causa_raiz is distinct from 'erro_cd' or (causa_carga is not null and causa_conferente is not null));
  end if;
end $$;
