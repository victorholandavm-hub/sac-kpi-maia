-- "Entrega" vira um tipo de NPS próprio, separado de "assistência técnica"
-- -- achado 09/09/2026 investigando como adiantar os 2 gatilhos que
-- faltam: o código já jogava troca/entrega de produto, envio de peça etc.
-- (tudo que o motorista atende) no mesmo balde de "assistencia_tecnica"
-- (o que o montador atende, tipo troca de peça/vistoria), mas a tela de
-- Resumo (AvaliacoesResumo.tsx) já mostra "Pós-entrega" como card
-- separado de "Pós-assistência técnica" -- o balde e a tela estavam
-- desalinhados.
alter table service_request_nps drop constraint if exists service_request_nps_tipo_check;
alter table service_request_nps add constraint service_request_nps_tipo_check
  check (tipo in ('montagem', 'assistencia_tecnica', 'entrega'));

alter table nps_detrator_status drop constraint if exists nps_detrator_status_origem_check;
alter table nps_detrator_status add constraint nps_detrator_status_origem_check
  check (origem in ('sac', 'montagem', 'assistencia_tecnica', 'entrega'));
