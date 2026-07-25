-- true = o chamado (de montagem ou desmontagem) também precisa da ação
-- complementar no mesmo atendimento (montagem que também precisa desmontar
-- o móvel antigo, ou desmontagem que também precisa montar o novo) — evita
-- abrir dois chamados separados pro mesmo cliente/visita.
alter table service_requests add column if not exists combo_montagem_desmontagem boolean not null default false;
