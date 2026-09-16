-- Correção do pedido de várias peças (migration 0131, 16/09/2026): o
-- desenho anterior (group_id amarrando VÁRIAS linhas de part_orders, uma
-- por peça, cada uma com seu próprio número de chamado) gerava um CHAMADO
-- PRA CADA PEÇA, só linkados entre si -- achado do Victor testando de
-- verdade (JOICE DA SILVA MARTINS, 3 produtos numa solicitação só,
-- viraram CH1675/CH1676/CH1677): "por que ficou em três chamados
-- diferentes? era pra ser tudo em um só". Ele tem razão -- o pedido
-- original ("a fábrica manda tudo junto") sempre foi sobre UM chamado
-- com várias peças dentro, não vários chamados linkados.
--
-- Correção: peças 2+ de uma solicitação passam a virar linhas em
-- part_order_items, ligadas a UM part_orders só (que continua sendo o
-- "chamado"/ticket, com seu único número de CH, status, datas de
-- chegada/envio etc. -- isso NÃO muda). part_orders.part_name/part_code/
-- color/product continuam existindo e guardam a 1ª peça (compatibilidade
-- total com as ~1677 linhas já existentes, sempre 1 peça = 1 chamado,
-- sem nenhuma linha em part_order_items). group_id (migration 0131) fica
-- pra trás como legado -- não é mais usado por solicitações novas, mas os
-- 3 chamados já criados (CH1675-1677) continuam funcionando com ele até
-- serem consolidados manualmente se o Victor quiser.
create table part_order_items (
  id uuid primary key default gen_random_uuid(),
  part_order_id uuid not null references part_orders(id) on delete cascade,
  part_name text not null,
  part_code text,
  color text,
  product text,
  created_at timestamptz not null default now()
);

create index part_order_items_part_order_id_idx on part_order_items (part_order_id);
