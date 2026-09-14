-- Histórico de "Peça chegou em" / "Enviada ao cliente em" -- pedido do
-- Victor 14/09/2026: "preciso que tanto assistencia quanto equipe técnica
-- possam editar a data de chegada da peça e data enviada para o
-- cliente... preciso que tenha historico em cada uma delas". Antes essas
-- duas datas só eram CARIMBADAS automaticamente numa troca de status
-- (updatePartOrderStatus/updatePartOrderDelivery, pecas-actions.ts) --
-- agora também ficam editáveis à mão (updatePartArrivedAt/
-- updateSentToClientAt), e cada edição manual vira uma linha aqui: quem
-- mudou, de qual valor pra qual, quando. Uma tabela só pros DOIS campos
-- (não duas tabelas) -- `field` distingue qual dos dois é cada linha,
-- mesmo padrão de service_request_events (events genéricos com um
-- `event_type`, não uma tabela por tipo de evento).
create table part_order_field_history (
  id uuid primary key default gen_random_uuid(),
  part_order_id uuid not null references part_orders(id) on delete cascade,
  field text not null check (field in ('part_arrived_at', 'sent_to_client_at')),
  old_value date,
  new_value date,
  -- Nome de quem mudou (perfil OU equipe técnica, nenhum dos dois é
  -- auth.uid() -- equipe técnica loga por PIN, sem usuário Supabase Auth
  -- por trás, mesmo motivo de causa_conferente/driver_name serem texto
  -- livre no resto do projeto) + o papel, pra exibir "Victor (assistência)"
  -- ou "João (equipe técnica)" sem precisar adivinhar pelo nome.
  changed_by text not null,
  changed_by_role text not null check (changed_by_role in ('assistencia', 'admin', 'tecnico')),
  changed_at timestamptz not null default now()
);

create index part_order_field_history_lookup_idx
  on part_order_field_history (part_order_id, field, changed_at desc);

-- Mesmo padrão de RLS de part_orders (só leitura direta pra
-- assistência/admin autenticados via Supabase Auth) -- defesa em
-- profundidade; o app em si sempre acessa via service_role
-- (getSupabaseAdmin(), bypassa RLS), inclusive nas ações chamadas pela
-- equipe técnica (sessão por PIN, não é um auth.uid() válido pra essa
-- policy alcançar de qualquer forma).
alter table part_order_field_history enable row level security;

create policy part_order_field_history_select on part_order_field_history
  for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role in ('assistencia', 'admin')
    )
  );
