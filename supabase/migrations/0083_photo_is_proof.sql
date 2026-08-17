-- Foto de comprovante assinado (motorista) -- distingue do resto da galeria
-- de fotos (observação, avaria etc.), que continua opcional. Ver
-- driver-actions.ts: driverCompleteRequest passa a exigir pelo menos uma
-- foto com is_proof = true antes de concluir (pedido do Victor 17/08/2026:
-- "só está concluída quando o cliente assina").

alter table service_request_photos add column if not exists is_proof boolean not null default false;
