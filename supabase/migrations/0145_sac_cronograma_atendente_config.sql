-- Exceções por atendente no Cronograma Diário do SAC -- pedido do Victor
-- 01/10/2026: "joab e luisa nao precisam entrar nesse cronograma e alynne
-- só pega a partir da 9h, então coloque todo o cronograma 1h pra frente
-- pra ela".
--
-- Tabela ESPARSA de propósito (1 linha só pra quem tem exceção, não 1
-- linha por atendente) -- ausência de linha = comportamento padrão
-- (participa=true, offset_minutos=0), ver getCronogramaAtendenteConfig em
-- cronogramaSac.ts. `offset_minutos` desloca pra FRENTE o horário de TODO
-- item do cronograma só pra esse atendente (08:00 -> 09:00 com +60, por
-- exemplo) -- não muda o cronograma de ninguém mais.
create table sac_cronograma_atendente_config (
  profile_id uuid primary key references profiles (id) on delete cascade,
  participa boolean not null default true,
  offset_minutos integer not null default 0,
  updated_at timestamptz not null default now()
);

-- Reaproveita a função set_updated_at já criada em 0001_service_requests.sql.
create trigger sac_cronograma_atendente_config_set_updated_at
  before update on sac_cronograma_atendente_config
  for each row execute function set_updated_at();

alter table sac_cronograma_atendente_config enable row level security;

create policy sac_cronograma_atendente_config_select_authenticated on sac_cronograma_atendente_config
  for select to authenticated using (true);

-- Aplica já o pedido de hoje -- Joab e Luisa saem do cronograma, Alynne
-- ganha 60min de atraso em todo item. Por nome (role 'sac'), não por id
-- fixo -- mais legível e sobrevive a um id diferente em outro ambiente.
insert into sac_cronograma_atendente_config (profile_id, participa, offset_minutos)
select id, false, 0 from profiles where role = 'sac' and full_name in ('Joab', 'Luisa')
on conflict (profile_id) do update set participa = excluded.participa;

insert into sac_cronograma_atendente_config (profile_id, participa, offset_minutos)
select id, true, 60 from profiles where role = 'sac' and full_name = 'Alynne'
on conflict (profile_id) do update set offset_minutos = excluded.offset_minutos;
