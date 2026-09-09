-- Sequência própria pro número de chamado da planilha (CHxxxx) -- pedido
-- do Victor 09/09/2026: "cada novo chamado gerado, preciso que siga a
-- ordem... se o ultimo chamado é o CH1643, o proximo deve ser o CH1644".
-- Maior número já usado no histórico importado é CH1643 (confirmado em
-- produção) -- começa em 1644. Função em vez de chamar nextval direto do
-- app: mantém o formato "CHxxx" (zero-padded até 3 dígitos, igual a
-- planilha original) num lugar só.
create sequence if not exists ch_number_seq start with 1644;

create or replace function next_ch_number() returns text
language sql
as $$
  select 'CH' || lpad(nextval('ch_number_seq')::text, 3, '0')
$$;
