-- Nota fiscal anexada na criação da notificação do SAC -- pedido do Victor
-- 09/09/2026: "preciso que adicionem a nota fiscal e que na hora de
-- imprimir, cada notificação saia junto com sua respectiva nota". Reaproveita
-- service_request_photos (já suporta imagem e PDF, ver ALLOWED_TYPES em
-- servicePhotos.ts) em vez de criar tabela nova -- mesmo padrão de is_proof
-- (comprovante do motorista): uma flag booleana a mais que já dá pra filtrar
-- em listRequestPhotos/getInvoicePhotos, sem mexer no resto do fluxo de
-- upload que já existe.
alter table service_request_photos add column if not exists is_invoice boolean not null default false;
