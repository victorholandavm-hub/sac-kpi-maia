-- Anexo (PDF) no pedido de peça -- pedido do Victor 22/09/2026: "colocar
-- após a observação da solicitação de peças pra anexar o arquivo em PDF da
-- foto feita da peça avariada". Um anexo por pedido (não uma galeria) --
-- reaproveita o storage local em disco já usado pelas fotos de chamado (ver
-- localPhotoStorage.ts/servicePhotos.ts, migrado do Supabase Storage
-- 20/08/2026 por egress) sob um prefixo próprio ("part-orders/"), servido
-- pela mesma rota genérica /api/photos/[...path] -- não precisa de tabela
-- nova nem rota nova, só o caminho guardado aqui.
alter table part_orders add column if not exists attachment_path text;
