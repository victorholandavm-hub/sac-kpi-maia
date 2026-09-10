-- A 0121 corrigiu a função mas o problema persistiu (achado do Victor
-- 10/09/2026, terceira vez: "CH164" de novo, colidindo com um CH164
-- histórico de verdade -- a sequência já estava em 1646 nesse ponto, então
-- o valor certo seria CH1646, truncado do mesmo jeito que antes mesmo com
-- a função corrigida). Não deu pra confirmar a causa exata (cache de plano
-- em alguma conexão do pool?) com acesso só de leitura -- a saída mais
-- segura é tirar TODA formatação de string do lado do banco: essa função
-- devolve só o número cru da sequência (bigint, nada de lpad/concatenação
-- possível de dar errado aqui), e o "CH" + zero-padding viram
-- responsabilidade só do código da aplicação (String.padStart, que nunca
-- trunca).
create or replace function next_ch_seq() returns bigint
language sql
as $$
  select nextval('ch_number_seq')
$$;
