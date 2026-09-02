-- Duas coisas achadas junto, 02/09/2026:
--
-- 1) Bug real, já ao vivo: "peca_nao_entregue" e "armazenamento_cd" foram
-- adicionadas em CAUSA_RAIZ_OPTIONS (assistenciaLabels.ts) em 29/08/2026,
-- mas a constraint `service_requests_causa_raiz_check` (criada em
-- 0080_causa_raiz_conferencia_motorista.sql) nunca foi atualizada com esses
-- dois valores -- confirmado 0 linhas em produção com qualquer um dos dois
-- (nenhuma tentativa de salvar jamais teve sucesso, sempre bateu na
-- constraint com o erro cru do Postgres em vez da mensagem amigável do
-- formulário). Corrige junto com o pedido abaixo pra não deixar esse "buraco"
-- aberto.
--
-- 2) Pedido do Victor 02/09/2026: "quando o motivo é que o produto foi
-- sujo, so tem a opção de colocar que foi culpa de armazenamento, quando na
-- verdade, quando o produto sai sujo, pode ser culpa do conferente tambem".
-- Nova causa raiz "sujeira_conferencia" -- mesma estrutura de
-- "erro_conferencia" (carga + conferente obrigatórios, é sempre sobre quem
-- não barrou o produto antes de sair), só que classificando
-- especificamente sujeira/mancha/mofo não percebida na conferência, em vez
-- de produto errado enviado (que é o que "erro_conferencia" já cobre).
-- "armazenamento_cd" continua existindo pro caso de sujeira que já veio do
-- jeito que o produto foi guardado no CD, não uma falha de quem conferiu.
alter table service_requests drop constraint if exists service_requests_causa_raiz_check;
alter table service_requests add constraint service_requests_causa_raiz_check
  check (causa_raiz is null or causa_raiz in (
    'erro_conferencia', 'erro_motorista', 'erro_loja', 'erro_vendedor', 'erro_sac',
    'avaria_transporte', 'defeito_fabricacao', 'peca_nao_entregue', 'armazenamento_cd',
    'sujeira_conferencia', 'solicitacao_cliente', 'outro'
  ));

alter table service_requests drop constraint if exists service_requests_causa_completa;
alter table service_requests add constraint service_requests_causa_completa check (
  (causa_raiz is distinct from 'erro_conferencia' or (causa_carga is not null and causa_conferente is not null))
  and
  (causa_raiz is distinct from 'sujeira_conferencia' or (causa_carga is not null and causa_conferente is not null))
  and
  (causa_raiz is distinct from 'erro_motorista' or (causa_carga is not null and driver_name is not null))
  and
  (causa_raiz is distinct from 'outro' or causa_raiz_detalhe is not null)
);
