-- Marca item por item se aquele produto já foi montado/desmontado de fato —
-- necessário pro montador poder concluir uma visita parcialmente (alguns
-- itens prontos, outros ficam pra outra data) sem perder o controle de qual
-- é qual. O chamado inteiro continua indo pro status "remarcar" nesse caso
-- (mesma regra de negócio que já existia pra "não consegui montar"); esta
-- coluna é só o detalhe por item.
alter table service_request_items
  add column if not exists completed boolean not null default false;
