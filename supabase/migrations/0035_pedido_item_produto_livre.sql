alter table pedido_encomenda_itens alter column produto_id drop not null;
alter table pedido_encomenda_itens add column if not exists produto_descricao text;
alter table pedido_encomenda_itens drop constraint if exists pedido_encomenda_itens_produto_check;
alter table pedido_encomenda_itens add constraint pedido_encomenda_itens_produto_check
  check (produto_id is not null or produto_descricao is not null);
