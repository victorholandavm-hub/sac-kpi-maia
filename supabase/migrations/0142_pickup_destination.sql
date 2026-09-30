-- Destino do produto recolhido -- pedido do Victor 30/09/2026: "nas
-- notificações de assistencia quando o atendente marcar que será uma troca
-- de produto ou um recolhimento de produto, ele, obrigatoriamente, terá
-- que responder... O produto recolhido irá para onde: Estoque CD, Avaria
-- CD, LOJA". Só se aplica a troca_produto/recolhimento_produto (os dois
-- únicos tipos do SAC que recolhem PRODUTO do cliente de verdade -- ver
-- DELIVERY_ITEM_NOUN em assistenciaLabels.ts) -- por isso fica nullable,
-- sem exigir nos outros tipos (obrigatoriedade por tipo é validada em
-- createSacRequest, actions.ts, igual causa_raiz/causa_carga).
--
-- Quando é "loja", a loja de destino é sempre a mesma já escolhida em
-- store_id -- pedido explícito do Victor ("tem que ser a loja que foi
-- marcada lá em cima, que é a loja do cliente") -- por isso não existe
-- coluna própria de "loja de destino", só o enum.
ALTER TABLE service_requests ADD COLUMN pickup_destination text;
ALTER TABLE service_requests ADD CONSTRAINT service_requests_pickup_destination_check
  CHECK (pickup_destination IS NULL OR pickup_destination IN ('estoque_cd', 'avaria_cd', 'loja'));
