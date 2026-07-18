-- Portal do montador: cada montador (tabela `assemblers`, hoje só um nome)
-- passa a ter um PIN de 4 dígitos (hash, nunca texto puro) pra logar numa
-- área própria e ver as próprias demandas, sem precisar de e-mail/senha.

alter table assemblers add column if not exists pin_hash text;
