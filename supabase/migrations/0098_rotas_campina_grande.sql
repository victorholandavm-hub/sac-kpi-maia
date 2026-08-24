-- Rotas de Campina Grande + "rota extra" genérica de João Pessoa --
-- pedido do Victor 24/08/2026: "agora, a gente tem as rotas de Campina
-- Grande, entao precisaremos ver uma forma de o atendente escolher
-- primeiro a cidade... em campina grande as rotas são:
-- centro/norte/leste e sul/oeste... campina nao tem rota extra. Por fim,
-- nas rotas extras de joão pessoa, fica por padrão o nome 'rota extra'
-- sem precisar escolher entre sul, centro e praia".
--
-- Só amplia os 3 check constraints existentes -- nenhuma coluna nova,
-- nenhum índice novo (ver plano: Campina Grande entra como linhas
-- is_extra:true em rota_driver_assignments, reaproveitando
-- addRotaExtra/removeRotaExtra sem precisar de mais nada no banco).

alter table service_requests drop constraint if exists service_requests_rota_check;
alter table service_requests add constraint service_requests_rota_check
  check (rota in ('praia', 'sul', 'centro', 'cg_centro_norte_leste', 'cg_sul_oeste', 'extra'));

alter table rota_weekday_config drop constraint if exists rota_weekday_config_rota_check;
alter table rota_weekday_config add constraint rota_weekday_config_rota_check
  check (rota in ('praia', 'sul', 'centro', 'cg_centro_norte_leste', 'cg_sul_oeste', 'extra'));

alter table rota_driver_assignments drop constraint if exists rota_driver_assignments_rota_check;
alter table rota_driver_assignments add constraint rota_driver_assignments_rota_check
  check (rota in ('praia', 'sul', 'centro', 'cg_centro_norte_leste', 'cg_sul_oeste', 'extra'));
