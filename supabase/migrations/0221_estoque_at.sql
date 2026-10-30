-- Estoque AT automático pela notificação de assistência -- Victor 30/10/2026:
-- "quando uma notificação de assistencia fosse feita no sistema, o produto a
-- ser entregue sairia do estoque CD e seria transferido para o estoque AT".
-- Cada transferência feita pela ponte (/inventario/transferir) fica registrada
-- aqui, uma vez por item e etapa, pra não repetir e pra saber o que desfazer
-- quando a notificação é cancelada ou o item sai dela.
create table if not exists estoque_at_movimentos (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references service_requests(id) on delete cascade,
  -- set null: item apagado/trocado numa edição -- a reserva continua aqui pra ser desfeita.
  item_id uuid references service_request_items(id) on delete set null,
  etapa text not null check (etapa in ('reserva', 'estorno', 'destino')),
  -- estorno aponta a reserva que ele desfaz.
  desfaz uuid references estoque_at_movimentos(id) on delete set null,
  codigo text not null,
  qtd numeric not null check (qtd > 0),
  origem text not null check (origem in ('estoque', 'avaria', 'assistencia')),
  destino text not null check (destino in ('estoque', 'avaria', 'assistencia')),
  situacao text not null check (situacao in ('feito', 'sem_saldo', 'erro')),
  picking text,
  mensagem text,
  tentativas int not null default 1,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index if not exists estoque_at_movimentos_item_etapa on estoque_at_movimentos (item_id, etapa) where item_id is not null and etapa <> 'estorno';
create unique index if not exists estoque_at_movimentos_desfaz on estoque_at_movimentos (desfaz) where desfaz is not null;
create index if not exists estoque_at_movimentos_request on estoque_at_movimentos (request_id);

-- Uma rodada por vez (cron de 30 min + a rodada logo depois de criar a
-- notificação): duas ao mesmo tempo transfeririam o mesmo item duas vezes.
create table if not exists estoque_at_trava (id int primary key check (id = 1), ate timestamptz not null);
insert into estoque_at_trava (id, ate) values (1, now() - interval '1 minute') on conflict (id) do nothing;
create or replace function estoque_at_pegar_trava(segundos int) returns boolean language sql as $$
  with t as (update estoque_at_trava set ate = now() + make_interval(secs => segundos) where id = 1 and ate < now() returning 1)
  select exists (select 1 from t);
$$;
create or replace function estoque_at_soltar_trava() returns void language sql as $$
  update estoque_at_trava set ate = now() - interval '1 second' where id = 1;
$$;

-- Dupla verificação na criação: faltava saldo livre no CD e o atendente marcou que está ciente.
alter table service_requests add column if not exists estoque_ciente_sem_saldo_por text;
alter table service_requests add column if not exists estoque_ciente_sem_saldo_em timestamptz;

notify pgrst, 'reload schema';
