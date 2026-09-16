-- Pedido do Victor 16/09/2026: "adicione a opção de eu adicionar mais de
-- uma peça na mesma solicitação, pois quando solicitamos mais de uma peça
-- junta, a fábrica manda tudo junto". Cada peça continua sendo sua PRÓPRIA
-- linha em part_orders (chegada/envio ao cliente/status continuam por
-- peça -- na prática quase sempre juntos, mas o sistema já rastreia cada
-- um separadamente e não faz sentido perder isso agora). group_id só
-- amarra as peças pedidas NA MESMA SUBMISSÃO do formulário, pra: (1) o
-- e-mail pro representante poder listar todas juntas num corpo só (mesmo
-- espírito do pedido -- "a fábrica manda tudo junto"), e (2) a tela de
-- detalhe/lista poder mostrar "faz parte de uma solicitação com mais
-- peças". null = pedido avulso (comportamento de sempre, inclusive todo o
-- histórico existente).
alter table part_orders add column group_id uuid null;

create index part_orders_group_id_idx on part_orders (group_id) where group_id is not null;
