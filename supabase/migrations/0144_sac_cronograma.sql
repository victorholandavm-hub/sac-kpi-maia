-- Cronograma Diário do SAC -- pedido do Victor 01/10/2026: lista fixa de
-- tarefas que cada atendente do SAC precisa confirmar todo dia (Dynamus,
-- Líder/Maia, tags de retorno, contato de assistência não concluída,
-- carga 004440, notificações do dia seguinte, tags de retorno de novo às
-- 16h) -- "quero que todos os atendentes fossem colocando como feito,
-- diariamente... quero poder ver e controlar diariamente", mais alerta
-- automático no Telegram quando alguém atrasa e taxa de cumprimento por
-- atendente ao longo do tempo.
--
-- sac_cronograma_itens é o MOLDE (editável no admin, ver
-- cronograma-actions.ts) -- os mesmos itens valem todo dia, não é um
-- registro por dia. "ativo=false" desativa sem apagar linhas de
-- sac_cronograma_completions que já apontam pra ele -- histórico continua
-- válido mesmo que o item saia de circulação depois.
create table sac_cronograma_itens (
  id uuid primary key default gen_random_uuid(),
  horario time not null,
  descricao text not null,
  ordem integer not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_sac_cronograma_itens_ativo_horario on sac_cronograma_itens (ativo, horario);

-- Reaproveita a função set_updated_at já criada em 0001_service_requests.sql.
create trigger sac_cronograma_itens_set_updated_at
  before update on sac_cronograma_itens
  for each row execute function set_updated_at();

-- Quem marcou o quê, em qual dia -- 1 linha por atendente x item x dia.
-- `data` é a data de CALENDÁRIO (fuso de João Pessoa, ver cronogramaSac.ts),
-- não timestamptz -- o cronograma é por DIA, não por instante exato.
create table sac_cronograma_completions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references sac_cronograma_itens (id) on delete cascade,
  profile_id uuid not null references profiles (id) on delete cascade,
  data date not null,
  completed_at timestamptz not null default now(),
  unique (item_id, profile_id, data)
);

create index idx_sac_cronograma_completions_data on sac_cronograma_completions (data);
create index idx_sac_cronograma_completions_profile on sac_cronograma_completions (profile_id, data);

-- Controle de quem já foi alertado no Telegram por atraso -- sem isso, o
-- cron de /api/sac-cronograma-check (a cada 15min, ver
-- .github/workflows/sac-cronograma-cron.yml) mandaria a MESMA mensagem de
-- novo a cada execução enquanto o item continuar pendente. 1 alerta por
-- atendente x item x dia (mesma granularidade de completions acima).
create table sac_cronograma_atraso_alertas (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references sac_cronograma_itens (id) on delete cascade,
  profile_id uuid not null references profiles (id) on delete cascade,
  data date not null,
  created_at timestamptz not null default now(),
  unique (item_id, profile_id, data)
);

-- RLS -- mesmo padrão do resto do projeto (service role pra toda escrita,
-- select pra authenticated só como camada extra de defesa, ver comentário
-- em 0027_pedidos_encomenda.sql).
alter table sac_cronograma_itens enable row level security;
alter table sac_cronograma_completions enable row level security;
alter table sac_cronograma_atraso_alertas enable row level security;

create policy sac_cronograma_itens_select_authenticated on sac_cronograma_itens for select to authenticated using (true);
create policy sac_cronograma_completions_select_authenticated on sac_cronograma_completions for select to authenticated using (true);
create policy sac_cronograma_atraso_alertas_select_authenticated on sac_cronograma_atraso_alertas for select to authenticated using (true);

-- Seed -- os 7 itens passados pelo Victor 01/10/2026.
insert into sac_cronograma_itens (horario, descricao, ordem) values
  ('08:00', 'Verificar clientes em aberto no Dynamus.', 1),
  ('08:30', 'Verificar Líder e Maia.', 2),
  ('09:00', 'Verificar clientes com tag de retorno e atualizar as tags.', 3),
  ('10:00', 'Entrar em contato com clientes com assistência não concluída no dia anterior.', 4),
  ('11:00', 'Verificar a carga 004440 no Protheus.', 5),
  ('12:00', 'Verificar notificações de assistência do dia seguinte para impressão.', 6),
  ('16:00', 'Verificar tags e retorno para clientes.', 7);
