-- Tela "Vendas por produto" (admin + CD): curva por período e ranking de
-- produtos mais vendidos, em cima de totvs_orders/totvs_order_items
-- (0039_totvs_sync.sql). Até aqui essas tabelas não tinham NENHUMA policy
-- pra "authenticated" -- só o service-role (usado pelo sync e por toda
-- leitura em código, ver src/lib/vendasProduto.ts) lia. Agora que existe UI
-- de verdade lendo, adiciona a mesma camada extra de defesa já usada nas
-- outras tabelas totvs_* (RLS não é a autorização real -- isso é checado em
-- código; CD nem usa Supabase Auth, então essa policy cobre só o caminho
-- admin).

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'totvs_orders' and policyname = 'totvs_orders_select_admin'
  ) then
    create policy totvs_orders_select_admin on totvs_orders
      for select to authenticated using (
        exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'totvs_order_items' and policyname = 'totvs_order_items_select_admin'
  ) then
    create policy totvs_order_items_select_admin on totvs_order_items
      for select to authenticated using (
        exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
      );
  end if;
end $$;
