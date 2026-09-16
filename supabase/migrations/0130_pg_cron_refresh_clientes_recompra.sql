-- A migration 0129 (SET statement_timeout dentro da função) NÃO resolveu
-- -- testado 15/09/2026, sync depois da correção falhou com o MESMO erro
-- exato, mesmo com plano Pro (afasta a hipótese de limite fixo de Free
-- tier). proconfig da função confirmado correto no banco (statement_
-- timeout=10min) três vezes, sem função duplicada/sombra -- o limite que
-- está cortando não é o que alteramos.
--
-- Troca de abordagem: em vez de tentar contornar o limite de
-- statement_timeout do role `authenticator` (8s, usado por TODO acesso via
-- API REST/RPC -- é como o sync de hoje chama essa função, via
-- `.rpc(...)` em totvsSync.ts), tira o refresh desse caminho por completo.
-- pg_cron roda como job em background DENTRO do próprio Postgres,
-- conectando direto (sem passar pelo PostgREST/API, sem o limite de 8s do
-- `authenticator` nunca chegar a valer) -- arquitetura mais robusta pra
-- manutenção pesada como essa, independente de eu nunca ter cravado por
-- que o SET dentro da função não bastou sozinho.
--
-- A função refresh_clientes_recompra_views() em si continua igual (já tem
-- seu próprio SET statement_timeout=10min, sem efeito nenhum aqui já que
-- quem chama agora nem passa pelo `authenticator`) -- só muda QUEM chama.
-- runTotvsSync (totvsSync.ts) continua tentando via `.rpc(...)` também,
-- sem mudança de código -- segue falhando do jeito de sempre (não quebra
-- nada, só fica redundante/log a mais), mas agora o pg_cron é quem de fato
-- mantém as views atualizadas.
create extension if not exists pg_cron;

-- A cada 30min, alinhado com o ritmo médio do sync do TOTVS (ver
-- comentário em runTotvsSync). Se já existir um agendamento com esse
-- nome (reaplicar a migration), remove antes -- cron.schedule não tem
-- "or replace", e cron.unschedule dá erro se o nome não existir.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'refresh-clientes-recompra-views') then
    perform cron.unschedule('refresh-clientes-recompra-views');
  end if;
end $$;

select cron.schedule(
  'refresh-clientes-recompra-views',
  '*/30 * * * *',
  $$select refresh_clientes_recompra_views()$$
);
