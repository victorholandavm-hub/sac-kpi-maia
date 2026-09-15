-- Achado 15/09/2026 revisando os dados de Nível de relacionamento/
-- Propensão a recompra: TODO sync do TOTVS desde 12/09/2026 ~17h (quando a
-- migration 0124 foi pro ar) falhou ao dar refresh nas duas materialized
-- views, sempre com o mesmo erro -- "canceling statement due to statement
-- timeout" (ver tabela sync_runs). Resultado prático: as duas telas
-- ficaram 3+ dias travadas na foto de 12/09, e 324 clientes que só
-- compraram pela primeira vez depois disso sumiram por completo das duas
-- (não aparecem nem na lista nem nos cards de resumo).
--
-- Causa raiz: o refresh é chamado via `.rpc(...)` (totvsSync.ts), que
-- passa pelo PostgREST autenticado como o role `authenticator` --
-- confirmado no banco que esse role tem `statement_timeout=8s`
-- configurado (ALTER ROLE), bem menor que o tempo real de refresh das
-- duas views (~3s + ~40s testado via EXPLAIN ANALYZE em 12/09, antes do
-- backfill terminar de vez -- deve ser mais hoje). O teste manual direto
-- no SQL Editor nunca pegou isso porque roda como `postgres`
-- (statement_timeout de sessão bem maior).
--
-- Correção: `SET statement_timeout` dentro da PRÓPRIA definição da função
-- -- um GUC de função em Postgres sobrescreve o limite da sessão de quem
-- chama, só durante a execução dessa função (padrão já documentado do
-- Postgres pra exatamente esse cenário: RPC longa chamada por um role com
-- timeout de sessão curto). 10min de folga generosa (bem acima do ~43s
-- testado em 12/09), sem mexer no timeout do role `authenticator` em si
-- (isso afetaria toda e qualquer outra chamada via PostgREST, não só essa
-- função).
create or replace function refresh_clientes_recompra_views()
returns void
language plpgsql
security definer
set search_path = public
set statement_timeout = '10min'
as $$
begin
  refresh materialized view concurrently v_clientes_agregado_nivel;
  refresh materialized view concurrently v_recompra_categorias_por_cliente;
end;
$$;

grant execute on function refresh_clientes_recompra_views() to service_role;
