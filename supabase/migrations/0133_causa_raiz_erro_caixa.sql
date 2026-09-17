-- Pedido do Victor 17/09/2026: adicionar "Erro do caixa" como causa raiz.
-- Constraint aditiva (mesmo padrão de 0080/0094/0104) -- mantém TODOS os
-- valores antigos permitidos (14 chamados em erro_loja, 41 em outro, 2 em
-- armazenamento_cd, 1 em sujeira_conferencia hoje), mesmo que a UI pare de
-- oferecer alguns deles como opção nova (ver CAUSA_RAIZ_OPTIONS,
-- assistenciaLabels.ts) -- só assim o registro histórico continua válido.
ALTER TABLE service_requests DROP CONSTRAINT service_requests_causa_raiz_check;
ALTER TABLE service_requests ADD CONSTRAINT service_requests_causa_raiz_check
  CHECK (causa_raiz IS NULL OR causa_raiz = ANY (ARRAY[
    'erro_conferencia','erro_motorista','erro_loja','erro_vendedor','erro_sac','erro_caixa',
    'avaria_transporte','defeito_fabricacao','peca_nao_entregue','armazenamento_cd',
    'sujeira_conferencia','solicitacao_cliente','outro'
  ]::text[]));
