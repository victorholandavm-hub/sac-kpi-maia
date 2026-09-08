-- Lista de trabalho dos detratores (nota baixa em qualquer NPS) -- pedido do
-- Victor 08/09/2026: "preciso de uma aba apenas com os nomes, contatos e
-- motivo de o cliente ser um detrator... isso deve valer para as
-- avaliações do sac e de todos os outros nps que serão colocados para
-- rodar". Uma linha só quando alguém do time mexe no status/motivo -- por
-- padrão (sem linha aqui) o detrator conta como "não contatado".
--
-- `origem` é extensível pros próximos NPS (pós-entrega, quando existir) --
-- hoje só sac (conversations, escala 1-5) e montagem/assistencia_tecnica
-- (service_request_nps, escala 0-10). `origem_id` é o id da linha de
-- origem (conversations.id ou service_request_nps.request_id) -- sem FK de
-- verdade de propósito, porque aponta pra tabelas diferentes dependendo da
-- origem.
create table if not exists nps_detrator_status (
  id uuid primary key default gen_random_uuid(),
  origem text not null check (origem in ('sac', 'montagem', 'assistencia_tecnica')),
  origem_id text not null,
  status text not null default 'nao_contatado' check (status in ('nao_contatado', 'em_contato', 'recuperado', 'perdido', 'sem_resposta')),
  motivo text,
  atualizado_em timestamptz not null default now(),
  atualizado_por text,
  unique (origem, origem_id)
);
