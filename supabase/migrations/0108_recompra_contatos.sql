-- Registro de contato comercial disparado pela aba "Propensão a recompra"
-- (/clientes) -- pedido do Victor 07/09/2026, Fase 2 do Motor de Recompra:
-- fecha o elo de feedback que o desenho original apontou como a peça que
-- falta (ver motor-de-recompra.html) -- sem isso, a régua nunca aprende se
-- uma abordagem funcionou. "Quem contatou" é texto livre porque o login do
-- painel de KPIs é senha única compartilhada do time, sem usuário
-- individual (ver dashboardSession.ts) -- não tem como saber quem foi de
-- outro jeito.
create table if not exists recompra_contatos (
  id uuid primary key default gen_random_uuid(),
  -- client_id = totvs_orders.client_id / totvs_clientes.protheus_code.
  client_id text not null,
  -- Segmento no momento do contato (contato_direto/reparar_antes/nutrir/
  -- nao_e_lead) -- snapshot, não recalculado depois -- pra dar pra medir
  -- taxa de conversão POR SEGMENTO mais tarde, mesmo que o cliente já
  -- tenha mudado de segmento quando alguém for analisar.
  segmento text not null,
  contatado_por text,
  contatado_em timestamptz not null default now(),
  -- null = ainda não sabe o resultado (contato feito, esperando retorno).
  resultado text,
  resultado_em timestamptz,
  nota text
);

create index if not exists recompra_contatos_client_id_idx on recompra_contatos (client_id);
