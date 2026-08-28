-- Nova opção "outro" pra equipe técnica classificar um item -- pedido do
-- Victor 28/08/2026: "precisa de mais uma possibilidade de classificação
-- que é 'outro' onde a equipe quando selecionar abre uma caixa de texto
-- livre pra digitar". Mesmo padrão de texto livre de "em_observacao"
-- (0097) -- reaproveita a mesma coluna destino_observacao -- mas "outro"
-- é uma classificação final de verdade (conta como "classificados" pra
-- equipe técnica, não abre uma fase própria como "em_observacao" faz,
-- ver itemPhase em tecnico/page.tsx).
alter table service_request_items drop constraint if exists service_request_items_destino_check;
alter table service_request_items add constraint service_request_items_destino_check
  check (
    destino is null
    or destino in ('fabrica', 'estoque', 'conserto', 'sem_condicoes', 'mostruario', 'pequena_avaria', 'peca_enviada', 'em_observacao', 'outro')
  );

alter table service_request_items drop constraint if exists service_request_items_destino_observacao_completo;
alter table service_request_items add constraint service_request_items_destino_observacao_completo
  check (destino not in ('em_observacao', 'outro') or destino_observacao is not null);
