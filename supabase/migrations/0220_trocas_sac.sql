-- Troca de produto na nota pelo SAC, autorizada pelo Victor -- 30/10/2026.
-- O atendente monta a troca (o que volta, o produto novo, como sai) e pede;
-- o Victor autoriza ou recusa; ao autorizar, a ponte do Pedro (perfil sac,
-- POST /pedido/{id}/troca-produto) gera o crédito/devolução e a venda nova.
create table if not exists trocas_sac (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  pedido text not null,
  pedido_id integer not null,
  cliente text,
  chamado text not null,
  solicitado_por text not null,
  -- {itens:[{codigo,qtd,descricao,preco}], novos:[{codigo,qtd,preco,nome}], modo, filial_retirada, data_entrega, motivo, justificativa}
  pedido_troca jsonb not null,
  valor_credito numeric,
  total_novo numeric,
  status text not null default 'pendente' check (status in ('pendente', 'recusada', 'executada', 'parcial', 'erro')),
  decidido_por text,
  decidido_em timestamptz,
  motivo_recusa text,
  resultado jsonb,
  erro text
);

create index if not exists trocas_sac_status_idx on trocas_sac (status, criado_em desc);

alter table trocas_sac enable row level security;
