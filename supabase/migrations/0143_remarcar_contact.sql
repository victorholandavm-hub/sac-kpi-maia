-- "Entrar em contato" -- pedido do Victor 01/10/2026: quando o motorista
-- (Junior, especificamente, mas vale pra qualquer um) marca uma notificação
-- de assistência como "Não concluída" (status 'remarcar', ver
-- driverReportIssue em driver-actions.ts), o atendente responsável precisa
-- marcar que já entrou em contato com o cliente pra remarcar -- senão o
-- chamado fica indistinguível de outro "remarcar" que ninguém tratou ainda.
--
-- Nullable, sem check -- null = ainda não contatado (badge "Entrar em
-- contato" aparece, ver RemarcarContactBadge em DeliveryStatusBadge.tsx).
-- Zerado de novo pelo próprio driverReportIssue a cada vez que o motorista
-- marca remarcar (ciclo pode se repetir no mesmo chamado: contato feito,
-- nova data marcada, motorista não consegue de novo).
ALTER TABLE service_requests ADD COLUMN remarcar_contact_attempted_at timestamptz;
ALTER TABLE service_requests ADD COLUMN remarcar_contact_attempted_by text;
