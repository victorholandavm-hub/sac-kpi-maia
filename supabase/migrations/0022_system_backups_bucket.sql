-- Bucket privado pra guardar backups diários (JSON) das tabelas do módulo de
-- assistência — o plano Free do Supabase não inclui backup automático, então
-- isso cobre o cenário de exclusão/erro acidental dentro do próprio app
-- (o mesmo tipo de risco de quando zeramos os dados históricos manualmente).

insert into storage.buckets (id, name, public)
values ('system-backups', 'system-backups', false)
on conflict (id) do nothing;
