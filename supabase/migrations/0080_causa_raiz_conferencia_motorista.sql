-- "erro_cd" (0077_troca_causa_raiz.sql, de ontem) misturava duas causas bem
-- diferentes pro relatório que o usuário pediu em 14/08/2026 ("preciso
-- metrificar erros de loja/vendedor, erros do SAC, erros de conferência e
-- erros do motorista separadamente") -- não dava pra saber, só pelos dados,
-- se quem errou foi o conferente ou o motorista. Substitui "erro_cd" por
-- "erro_conferencia" (mantém carga+conferente obrigatórios) e
-- "erro_motorista" (carga + o motorista já registrado no chamado, ver
-- driver_name), e acrescenta "erro_sac" (causa que não existia antes).
--
-- Sem backfill: nenhuma linha em produção usava "erro_cd" ainda (conferido
-- antes de escrever essa migration) -- é troca de enum limpa, não dado
-- histórico pra migrar.
--
-- O check de "causa_raiz in (...)" em 0077 foi criado sem nome (inline no
-- ADD COLUMN), então o Postgres gerou o nome sozinho -- em vez de assumir
-- qual foi, acha pelo catálogo (mesmo espírito de "add constraint if not
-- exists" que o projeto já usa via pg_constraint, ver 0072/0075/0077).
do $$
declare
  old_check_name text;
begin
  select con.conname into old_check_name
  from pg_constraint con
  where con.conrelid = 'service_requests'::regclass
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%causa_raiz%in%'
  limit 1;

  if old_check_name is not null then
    execute format('alter table service_requests drop constraint %I', old_check_name);
  end if;
end $$;

alter table service_requests add constraint service_requests_causa_raiz_check
  check (causa_raiz is null or causa_raiz in (
    'erro_conferencia', 'erro_motorista', 'erro_loja', 'erro_vendedor', 'erro_sac',
    'avaria_transporte', 'defeito_fabricacao', 'solicitacao_cliente', 'outro'
  ));

alter table service_requests drop constraint if exists service_requests_causa_cd_completa;
alter table service_requests add constraint service_requests_causa_completa check (
  (causa_raiz is distinct from 'erro_conferencia' or (causa_carga is not null and causa_conferente is not null))
  and
  (causa_raiz is distinct from 'erro_motorista' or (causa_carga is not null and driver_name is not null))
);
