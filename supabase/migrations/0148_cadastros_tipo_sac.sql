-- Adiciona "SAC" como tipo de solicitação em Cadastros -- pedido do Victor
-- 01/10/2026 ("acrescentar no motivo do chamado: SAC"), print da aba
-- "Solicitação" do formulário Novo Cadastro (Assistência/Troca/Erro de
-- entrega/Erro de faturamento/Montagem).
alter table assistencia_cadastros_historico drop constraint assistencia_cadastros_historico_tipo_check;
alter table assistencia_cadastros_historico
  add constraint assistencia_cadastros_historico_tipo_check
  check (tipo in ('ASSISTENCIA', 'TROCA', 'ERRO_ENTREGA', 'ERRO_FATURAMENTO', 'MONTAGEM', 'HISTORICO', 'SAC'));
