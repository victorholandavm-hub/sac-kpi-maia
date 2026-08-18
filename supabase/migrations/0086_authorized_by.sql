-- "Autorizado por" -- pedido do Victor 18/08/2026: o despacho impresso
-- mostrava o nome de quem criou o chamado no sistema (requested_by_name /
-- requester) como se fosse quem autorizou a troca/entrega/envio, o que quase
-- nunca é a mesma pessoa. Campo livre novo, preenchido por quem está
-- solicitando com o nome de quem de fato autorizou.

alter table service_requests add column if not exists authorized_by text;
