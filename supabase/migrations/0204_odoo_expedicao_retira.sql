-- Loja onde o cliente retira (ABA) e venda express na expedição do Odoo --
-- Victor 26/10/2026: SAC e assistência precisam ver filial de venda, filial de
-- entrega e se o cliente retira na loja.
alter table odoo_expedicao add column if not exists retira_em text;
alter table odoo_expedicao add column if not exists expresso boolean not null default false;
