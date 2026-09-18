-- Controle dos horários do caminhão do Junior (carregamento/saída/chegada/
-- descarregamento) -- pedido do Victor 18/09/2026: "preciso que apareça
-- apenas para mim... controlar os horários de saída e chegada, carregamento
-- e descarregamento apenas do carro de Junior que é o caminhão próprio da
-- assistência". Sem vínculo com service_requests/pedidos_encomenda de
-- propósito -- é um log manual de operação do veículo em si, não de um
-- chamado específico. Mais de uma linha por dia é permitido (o caminhão
-- pode rodar mais de uma viagem no mesmo dia).
create table if not exists junior_truck_log (
  id uuid primary key default gen_random_uuid(),
  log_date date not null,
  loading_time time,
  departure_time time,
  arrival_time time,
  unloading_time time,
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_junior_truck_log_date on junior_truck_log (log_date desc);
