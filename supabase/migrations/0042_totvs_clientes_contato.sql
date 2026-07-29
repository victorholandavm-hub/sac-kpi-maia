-- O endpoint de lista do WSClient (/rest/client, já usado pelo sync) já
-- retorna telefone/email/endereço em cada registro -- não precisa de
-- chamada nova nem de sync separado, só passar a guardar o que já vem.
-- Usado pra sugerir dados do cliente ao digitar o código dele em
-- PublicRequestForm.tsx (autopreenche nome/CPF/telefone; endereço vem como
-- sugestão editável, não trava, porque o cliente pode ter mudado).

alter table totvs_clientes add column if not exists phone1 text;
alter table totvs_clientes add column if not exists phone2 text;
alter table totvs_clientes add column if not exists email text;
alter table totvs_clientes add column if not exists contact_name text;
alter table totvs_clientes add column if not exists address_street text;
alter table totvs_clientes add column if not exists address_number text;
alter table totvs_clientes add column if not exists address_complement text;
alter table totvs_clientes add column if not exists address_neighborhood text;
alter table totvs_clientes add column if not exists address_city text;
alter table totvs_clientes add column if not exists address_cep text;
alter table totvs_clientes add column if not exists address_state text;

-- Guarda qual código de cliente foi usado/encontrado na busca -- só
-- informativo (igual pedidos_encomenda.cliente_codigo), não é FK.
alter table service_requests add column if not exists client_protheus_code text;
