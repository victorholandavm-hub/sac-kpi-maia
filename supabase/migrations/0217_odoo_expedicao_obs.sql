-- Observação do pedido (nota do vendedor) na leitura da expedição -- Victor
-- 29/10/2026: pedido de troca do SAC ("TROCA C/ RECOLHIMENTO SAC") é lançado
-- como venda e recebia as pesquisas de loja/entrega/compra; com a observação
-- guardada, as pesquisas pulam a troca.
alter table odoo_expedicao add column if not exists obs text;
