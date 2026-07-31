-- Prazo único (prazo_entrega, opcional) vira dois prazos, um por etapa da
-- cadeia -- fábrica promete um prazo pro CD ao aceitar o pedido (marcar "em
-- produção"), CD promete um prazo pra loja ao aceitar/carregar (marcar
-- "informar carga e expedir"). Os dois passam a ser obrigatórios nessas
-- transições (ver advancePedidoStatus). Mantém prazo_entrega intacto (dado já
-- em produção, sem motivo pra apagar), só para de usar ele daqui pra frente.
alter table pedidos_encomenda add column if not exists prazo_fabrica_cd date;
alter table pedidos_encomenda add column if not exists prazo_cd_loja date;
