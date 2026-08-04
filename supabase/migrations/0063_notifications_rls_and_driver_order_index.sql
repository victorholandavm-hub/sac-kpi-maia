-- notifications: mesma falha da RLS de PIN (0061) reintroduzida numa tabela
-- nova -- policy "using (true)" deixava qualquer authenticated ler
-- notificações de todas as lojas/fábricas/CD e os alertas de admin direto
-- pela API. O app só lê via getSupabaseAdmin() no servidor, então remover a
-- policy (RLS habilitado sem policy = deny-all client-side) não quebra nada.
drop policy if exists notifications_select_authenticated on notifications;

-- driver_order: usado como primeiro critério de ORDER BY em toda carga da
-- tela do motorista (listRequestsForDriver), sem índice era table scan.
create index if not exists service_requests_driver_order_idx
  on service_requests (driver_name, driver_order);
