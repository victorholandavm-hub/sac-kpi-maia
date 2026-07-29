-- O mesmo cpf_cnpj aparece em mais de um protheus_code no Protheus (cliente
-- cadastrado por loja/filial) -- descoberto rodando o sync de verdade em
-- 2026-07-29 (3 de 100 clientes falharam por violação dessa constraint).
-- protheus_code continua sendo a chave real pro upsert.

alter table totvs_clientes drop constraint if exists totvs_clientes_cpf_cnpj_key;

create index if not exists totvs_clientes_cpf_cnpj_idx on totvs_clientes (cpf_cnpj);
