-- Salvaguarda de LGPD do Motor de Recompra -- pedido do Victor 07/09/2026:
-- o dado de contato (telefone/nome) vem do Protheus pra fim de venda/
-- entrega/assistência; usar pra contato comercial PROATIVO (a lista de
-- "Propensão a recompra") é uso diferente do original. Base legal
-- escolhida: legítimo interesse (cliente que já comprou, não é contato
-- frio) -- mas isso exige um jeito de opt-out. Quem está aqui NUNCA mais
-- aparece na lista de candidatos a recompra (ver listRecompraCandidatos,
-- recompra.ts), até ser removido de novo.
create table if not exists recompra_nao_contatar (
  client_id text primary key,
  motivo text,
  criado_por text,
  criado_em timestamptz not null default now()
);
