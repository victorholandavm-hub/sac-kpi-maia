-- Canal de aquisição -- pedido do Victor 07/09/2026: "como esse cliente
-- chegou até a loja" (indicação, Instagram, passou na rua...). Não existe
-- em nenhum sistema hoje (nem Protheus, nem os apps) -- essa tabela é o
-- lugar novo pra guardar essa resposta, preenchida manualmente aos poucos
-- (ver select em /clientes, aba Status). Um canal só por cliente (decisão
-- do Victor 07/09/2026: "só um por cliente" -- mais simples de preencher
-- e analisar do que permitir vários).
create table if not exists cliente_canal_aquisicao (
  client_id text primary key,
  canal text not null,
  definido_por text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
