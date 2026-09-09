-- Contato do representante por FORNECEDOR (não mais só por pedido) --
-- pedido do Victor 09/09/2026: "quando... selecionar o fornecedor, já
-- deve puxar automaticamente o nome, contato e e-mail do representante
-- daquele fornecedor".
alter table suppliers add column if not exists representative text;
alter table suppliers add column if not exists representative_email text;
alter table suppliers add column if not exists representative_phone text;

-- Backfill a partir do histórico já importado (planilha "Solicitação de
-- peças", migration 0117) -- pega o representante/contato do pedido de
-- peça MAIS RECENTE de cada fornecedor (representante de um fornecedor é
-- estável ao longo do tempo, já confirmado nos dados: mesmo email/telefone
-- em centenas de pedidos do mesmo fornecedor).
update suppliers s
set representative = po.representative,
    representative_email = po.representative_email,
    representative_phone = po.representative_phone
from (
  select distinct on (supplier) supplier, representative, representative_email, representative_phone
  from part_orders
  where supplier is not null and representative_email is not null
  order by supplier, created_at desc
) po
where po.supplier = s.name;
