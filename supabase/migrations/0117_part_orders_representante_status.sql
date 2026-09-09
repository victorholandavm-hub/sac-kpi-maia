-- Amplia part_orders com a "inteligência" da planilha "Solicitação de
-- peças" (aba Pendências) -- pedido do Victor 09/09/2026. Contato do
-- representante (email/telefone) nunca existia -- só tinha contato do
-- cliente. Dois status novos: "aguardando_resposta" (fornecedor ainda não
-- confirmou nada, diferente de "aguardando_peca" -- já confirmou e vai
-- enviar) e "cancelada" -- ambos já existiam como situações distintas na
-- planilha, confirmado com o Victor via AskUserQuestion 09/09/2026.
alter table part_orders add column if not exists representative_email text;
alter table part_orders add column if not exists representative_phone text;

alter table part_orders drop constraint if exists part_orders_status_check;
alter table part_orders add constraint part_orders_status_check
  check (status in ('aguardando_peca', 'aguardando_resposta', 'peca_recebida', 'enviada_ao_cliente', 'encerrado', 'cancelada'));
