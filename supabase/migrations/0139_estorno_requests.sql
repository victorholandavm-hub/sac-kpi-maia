-- Fluxo de solicitação de estorno: caixa/gerente de loja pede, financeiro
-- (papel novo, contas individuais por PIN) processa por fora e anexa o
-- comprovante ou recusa com motivo -- pedido do Victor 23/09/2026.
-- Separado de propósito da tabela `estornos` (migration 0135) -- aquela é
-- um log histórico manual (senha única do painel de KPIs, sem anexo,
-- alimentado por import de Excel); esta é o fluxo ativo, com anexo
-- obrigatório dos dois lados.
create table financeiros (
  name text primary key,
  pin_hash text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table estorno_requests (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id),
  requester_role text not null check (requester_role in ('caixa','gerente')),
  requester_name text not null,
  cliente_nome text not null,
  cpf text,
  codigo_cliente text,
  nf_entrada text,
  nf_devolucao text,
  valor_reembolso numeric(12,2) not null check (valor_reembolso >= 0),
  data_venda date,
  forma_pagamento text,
  motivo text,
  produto text,
  autorizado_por text,
  anexo_solicitacao_path text not null,
  status text not null default 'pendente' check (status in ('pendente','concluido','recusado')),
  anexo_comprovante_path text,
  concluido_por text references financeiros(name),
  concluido_em timestamptz,
  recusado_por text references financeiros(name),
  recusado_em timestamptz,
  motivo_recusa text,
  created_at timestamptz not null default now()
);

create index idx_estorno_requests_status on estorno_requests (status);
create index idx_estorno_requests_store on estorno_requests (store_id);

alter table financeiros enable row level security;
alter table estorno_requests enable row level security;

-- Mesmo padrão de 0135_estornos.sql: só select pra authenticated (admin via
-- Supabase Auth); todo write passa por server action com getSupabaseAdmin()
-- (service role), igual toda tabela de ator PIN do projeto (caixas, tecnicos
-- etc.) -- não tem policy de insert/update, de propósito.
create policy financeiros_select_authenticated on financeiros for select to authenticated using (true);
create policy estorno_requests_select_authenticated on estorno_requests for select to authenticated using (true);
