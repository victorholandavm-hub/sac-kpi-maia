-- Restrição de horário/turno do cliente pra entregas (pedido do Victor
-- 19/08/2026): "só pode receber de manhã ou só a tarde e só recebe das
-- 14h as 17h, algo assim". Texto livre de propósito -- cobre qualquer
-- combinação (turno, faixa de hora, dia específico) sem precisar de um
-- seletor estruturado. Separado de restriction_note (que já existe, mas é
-- usado com outro sentido: "o que recolher / instrução pro motorista" em
-- troca_produto) -- confundir os dois ia misturar instrução de logística
-- com restrição do cliente.
alter table service_requests add column if not exists client_time_restriction text;
