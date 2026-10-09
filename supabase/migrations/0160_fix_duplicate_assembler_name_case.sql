-- Corrige o chamado #7547 (desmontagem, concluída, 30/09/2026): tinha
-- assembler_name = 'manoel' (minúsculo), uma linha SEPARADA de 'Manoel' na
-- tabela assemblers (nome é PK exata, sem normalização antes dessa correção
-- -- ver resolveAssemblerName em payments.ts, adicionado junto com essa
-- migração pra prevenir recorrência).
--
-- Efeito do bug: toda exclusão de Manoel/Adriel CD da lista de Pagamentos/
-- Agenda (EQUIPE_INTERNA_ASSEMBLERS, assistenciaLabels.ts) compara string
-- exata -- a variação de caixa fazia esse chamado aparecer como se fosse de
-- um montador terceirizado comum na aba de Pagamentos (como "manoel", sem
-- valor definido) e sumir da Agenda do Manoel de verdade.
--
-- Ordem importa: service_requests.assembler_name tem FK pra
-- assemblers.name -- corrige quem referencia 'manoel' ANTES de apagar a
-- linha órfã, senão a FK barra o delete.
update service_requests set assembler_name = 'Manoel' where assembler_name = 'manoel';
delete from assemblers where name = 'manoel';
