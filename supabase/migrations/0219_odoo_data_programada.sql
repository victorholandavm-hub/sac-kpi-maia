-- Data programada que o CD/SAC escolheu na Expedição -- Victor 29/10/2026
-- (S00250, Cleonice: o Jhon programa 31/10 e a saída fica 31/10 no Odoo, mas
-- a ponte mostra a "data de entrega" do pedido, 31/12). A tela mostra a
-- daqui até a ponte devolver a mesma data (aí a linha é apagada).
create table if not exists odoo_data_programada (
  picking_id integer primary key,
  dia date not null,
  por text not null,
  em timestamptz not null default now()
);

alter table odoo_data_programada enable row level security;
