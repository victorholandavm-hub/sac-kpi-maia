-- Achado na auditoria de segurança de 2026-08-03: assemblers, drivers,
-- cd_operadores, fabrica_operadores, gerentes, caixas e encomenda_caixa_pins
-- guardam pin_hash e tinham policy "for select to authenticated using (true)"
-- -- qualquer sessão autenticada de verdade (admin, mas também assistência e
-- sac, que já usam Supabase Auth de verdade, ver src/lib/supabaseBrowser.ts +
-- RealtimeQueueRefresher.tsx) conseguia consultar essas tabelas direto do
-- console do navegador com o client browser já carregado na página e puxar o
-- hash do PIN de qualquer montador/motorista/CD/fábrica/gerente/caixa.
--
-- Nenhuma tela do app precisa ler essas tabelas pelo client do navegador --
-- toda listagem/login passa por server action com getSupabaseAdmin (service
-- role, ignora RLS). Por isso a correção é só remover a policy de select,
-- deixando RLS ligado sem nenhuma policy (mesmo padrão já usado em
-- login_ip_rate_limit/public_request_submissions): nega tudo pro client
-- autenticado comum, sem afetar o service role.

drop policy if exists assemblers_select_authenticated on assemblers;
drop policy if exists drivers_select_authenticated on drivers;
drop policy if exists cd_operadores_select_authenticated on cd_operadores;
drop policy if exists fabrica_operadores_select_authenticated on fabrica_operadores;
drop policy if exists encomenda_caixa_pins_select_authenticated on encomenda_caixa_pins;
drop policy if exists caixas_select_authenticated on caixas;
drop policy if exists gerentes_select_authenticated on gerentes;
