-- Cache de URL assinada -- achado 18/08/2026 investigando estouro de egress
-- do Supabase (36GB+ contra um banco de 109MB): a página de fila de
-- encomendas (RealtimeQueueRefresher, atualiza sozinha a cada 15s) gerava
-- uma URL assinada NOVA pra cada foto a cada atualização, mesmo sem nada ter
-- mudado -- o navegador nunca conseguia usar cache porque a URL trocava toda
-- vez. Uma foto sozinha chegou a ser baixada 1025 vezes no mesmo dia. Guardar
-- a URL já assinada (e reusar enquanto não estiver perto de vencer) resolve
-- isso na raiz.

alter table service_request_photos add column if not exists signed_url text;
alter table service_request_photos add column if not exists signed_url_expires_at timestamptz;

alter table pedido_encomenda_photos add column if not exists signed_url text;
alter table pedido_encomenda_photos add column if not exists signed_url_expires_at timestamptz;
