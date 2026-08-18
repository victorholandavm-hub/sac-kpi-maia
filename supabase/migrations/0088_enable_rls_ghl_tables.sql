-- Achado 18/08/2026 via get_advisors (Supabase MCP): 4 tabelas do módulo de
-- integração com o GHL sem Row Level Security -- ficavam totalmente
-- expostas pra leitura/escrita por qualquer um com a chave anon. Nenhum
-- código do navegador acessa essas tabelas (confirmado por busca no repo --
-- só o cliente admin/service role, que sempre ignora RLS, mexe nelas), e as
-- tabelas irmãs do mesmo domínio (contacts, conversations, tag_events) já
-- tinham RLS ativado sem política nenhuma (nega tudo pra anon/authenticated,
-- só o service role passa) -- só deixa essas 4 consistentes com o resto.

alter table contact_current_tags enable row level security;
alter table conversation_ai_insight enable row level security;
alter table agents enable row level security;
alter table conversation_escalations enable row level security;
