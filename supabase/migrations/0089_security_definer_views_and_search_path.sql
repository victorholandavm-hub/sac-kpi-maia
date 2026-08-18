-- Achados 18/08/2026 via get_advisors (Supabase MCP), tratando junto com
-- 0088. Confirmado antes de aplicar: todas as views/funções abaixo só são
-- consultadas pelo cliente admin/service role (nenhum uso pelo navegador com
-- chave anon no repo) -- e as views já não tinham nenhum GRANT pra
-- anon/authenticated (checado direto em information_schema), então na
-- prática já não estavam expostas; essa migration fecha o buraco mesmo
-- assim, pro caso de alguém conceder acesso a elas no futuro sem perceber a
-- implicação de segurança.

-- 1) Views com SECURITY DEFINER rodam com o dono da view (bypassa RLS de
-- quem consulta) -- vira SECURITY INVOKER (padrão do Postgres 15+), que
-- respeita a permissão/RLS de quem realmente consulta. Sem efeito no app
-- (service role sempre bypassa RLS de qualquer forma).
alter view public.v_conversation_ticket set (security_invoker = true);
alter view public.v_escalations set (security_invoker = true);
alter view public.v_conversation_tags set (security_invoker = true);
alter view public.v_ticket_dimensions set (security_invoker = true);
alter view public.v_ticket_kpi set (security_invoker = true);
alter view public.v_backlog_aberto set (security_invoker = true);
alter view public.v_ticket_enriched set (security_invoker = true);
alter view public.v_client_purchase_summary set (security_invoker = true);

-- 2) Extensão unaccent movida de public pra extensions (convenção do
-- Supabase) -- ALTER EXTENSION SET SCHEMA move a extensão inteira (função +
-- dicionário de busca) sem precisar recriar nada.
alter extension unaccent set schema extensions;

-- 3) search_path fixo nas funções que dependiam do unaccent -- sem isso elas
-- ficariam sem achar `unaccent(...)` depois do passo 2 (referência sem
-- qualificar schema, resolvida pelo search_path em tempo de execução).
-- set_updated_at não usa unaccent, só precisa do search_path travado (vazio
-- já basta, só usa `now()`, que é sempre resolvido).
alter function public.unaccent_immutable(text) set search_path = 'public, extensions';
alter function public.search_arsenal_sac(text, text) set search_path = 'public, extensions';
alter function public.set_updated_at() set search_path = '';
