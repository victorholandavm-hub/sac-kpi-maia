-- Código do cliente (TOTVS) -- pedido do Victor 03/10/2026: aparecer nos
-- detalhes do cadastro, e principalmente pra alimentar o lookup automático
-- (nome/CPF/telefone/endereço reais) ao "Criar nova visita/entrega" a
-- partir de um cadastro -- antes só tinha o `codigo` do PRODUTO, sem jeito
-- nenhum de puxar o cliente certo no TOTVS.
alter table assistencia_cadastros_historico
  add column codigo_cliente text;
