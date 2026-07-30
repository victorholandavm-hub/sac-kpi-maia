-- Achado rodando contra dado real (2026-07-30): totvs_clientes e
-- totvs_orders são quase disjuntos por cpf_cnpj -- de 782 CPF/CNPJ
-- distintos que compraram (totvs_orders), só 10 têm cadastro correspondente
-- em totvs_clientes. Os dois syncs cobrem universos diferentes do TOTVS
-- (mesmo "motivo" documentado em 0039_totvs_sync.sql pra não ter FK entre
-- eles). Por isso totvs_orders passa a ser a fonte de verdade de "quem é
-- cliente" em src/lib/customerProfile.ts -- totvs_clientes vira só
-- enriquecimento opcional (bairro/telefone) quando existir.
--
-- client_name adicionado aqui pra não precisar de uma segunda query só pra
-- exibir o nome de clientes sem cadastro em totvs_clientes. Pega o nome do
-- pedido mais recente (varia um pouco de grafia entre notas às vezes, mas é
-- só exibição, não é chave de nada).
--
-- client_name fica no FINAL da lista de colunas, não logo após cpf_cnpj:
-- CREATE OR REPLACE VIEW só aceita ACRESCENTAR coluna no fim -- mudar a
-- posição de uma coluna já existente (total_compras deixaria de ser a 2ª
-- coluna) dá erro 42P16 "cannot change name of view column".

create or replace view v_client_purchase_summary as
select
  client_cpf_cnpj as cpf_cnpj,
  count(*) filter (where type = 'Venda') as total_compras,
  coalesce(sum(invoice_total) filter (where type = 'Venda'), 0) as valor_bruto,
  coalesce(sum(invoice_total), 0) as valor_liquido,
  avg(invoice_total) filter (where type = 'Venda') as ticket_medio,
  min(issue_date) filter (where type = 'Venda') as primeira_compra,
  max(issue_date) filter (where type = 'Venda') as ultima_compra,
  (array_agg(client_name order by issue_date desc))[1] as client_name
from totvs_orders
where client_cpf_cnpj is not null
group by client_cpf_cnpj;
