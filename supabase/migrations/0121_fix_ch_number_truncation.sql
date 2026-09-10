-- Bug real na 0119: lpad(texto, 3, '0') TRUNCA quando o texto já é maior
-- que 3 caracteres (não é só "preenche até 3, ou mais se precisar" --
-- Postgres corta à direita quando já é mais longo). "1644" virou "164",
-- perdendo o último dígito -- achado do Victor 10/09/2026 ("O NUMERO DO
-- CHAMADO FICOU BUGADO SEM O ULTIMO DIGITO"), reproduzido em 2 pedidos
-- reais (CH1644 e CH1645, ambos gravados como "CH164").
--
-- Corrige a função: chama nextval() só UMA vez (guardado em `n` -- a
-- versão anterior deste arquivo chamava nextval() duas vezes dentro da
-- mesma expressão SQL, o que consumiria 2 números da sequência por
-- chamada e ainda por cima combinaria dois valores DIFERENTES -- corrigido
-- antes de rodar). lpad até greatest(length(n), 3) preenche com zero até
-- 3 dígitos quando é menor, e vira no-op (sem truncar nada) quando já tem
-- 3 dígitos ou mais.
create or replace function next_ch_number() returns text
language plpgsql
as $$
declare
  n text;
begin
  n := nextval('ch_number_seq')::text;
  return 'CH' || lpad(n, greatest(length(n), 3), '0');
end;
$$;

-- Corrige os 2 pedidos reais já afetados -- ch_number_seq confirmado em
-- 1645 (exatamente 2 chamadas desde que a sequência começou em 1644), na
-- ordem de criação: Luciene (11:21) pegou 1644, Matheus (11:58) pegou 1645.
update part_orders set external_reference = 'CH1644'
  where id = 'ef1e54cd-a4b6-46b7-8112-9fba5cf47eb4' and external_reference = 'CH164';
update part_orders set external_reference = 'CH1645'
  where id = '3588a2f4-79b5-4c32-ba48-52201e3ed631' and external_reference = 'CH164';
