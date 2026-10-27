-- Notas de entrega (remessa, CFOP 5117) do Protheus guardadas no nosso disco
-- -- Victor 27/10/2026: com o Protheus congelado (e prestes a ser desligado),
-- o SAC precisa imprimir a nota das entregas antigas. A API original
-- (/ai/deliveries/nota/{filial}/{pedido}/{id}) devolve o PDF e o XML; os
-- arquivos ficam em NOTAS_PROTHEUS_DIR/<chave>.pdf|.xml e esta tabela é o
-- índice. A nota de VENDA (5922) não vem por esse caminho.

create table if not exists protheus_notas_entrega (
  chave text primary key,
  filial text not null,
  pedido text not null,
  zae_id text not null,
  nota text,
  serie text,
  cfop text,
  emissao date,
  tem_pdf boolean not null default false,
  tem_xml boolean not null default false,
  salvo_em timestamptz not null default now()
);

create index if not exists protheus_notas_entrega_pedido_idx on protheus_notas_entrega (filial, pedido);

alter table protheus_notas_entrega enable row level security;

-- Cópia de madrugada, um dia de entregas por vez (do mais novo pro mais antigo).
create table if not exists protheus_notas_copia (
  dia date primary key,
  entregas integer not null default 0,
  notas integer not null default 0,
  sem_nota integer not null default 0,
  falhas integer not null default 0,
  feito_em timestamptz not null default now()
);

alter table protheus_notas_copia enable row level security;
