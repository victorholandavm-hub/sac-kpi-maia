-- Gerente passa a poder cadastrar/inativar caixa e vendedor das próprias
-- lojas (src/app/assistencia/loja-equipe-actions.ts). Pra isso, caixa precisa
-- deixar de ser "1 PIN por loja" e virar individual (nome + PIN próprio),
-- igual vendedor -- só assim faz sentido "cadastrar" ou "inativar" uma caixa
-- específica. Ambos (caixa e vendedor) ganham "ativo" pro toggle de acesso.

-- 1. Vendedor ganha ativo -------------------------------------------------------

alter table vendedores add column if not exists ativo boolean not null default true;

-- 2. Caixa vira individual (nome + PIN próprio, presa a 1 loja) -----------------

create table if not exists caixas (
  name text primary key,
  store_id text not null references stores (id) on delete cascade,
  pin_hash text,
  ativo boolean not null default true,
  failed_pin_attempts integer not null default 0,
  pin_locked_until timestamptz
);

alter table caixas enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'caixas' and policyname = 'caixas_select_authenticated'
  ) then
    create policy caixas_select_authenticated on caixas for select to authenticated using (true);
  end if;
end $$;

-- 3. Migra os PINs que já existem em encomenda_caixa_pins pra caixas -------------
-- Nomeia com o nome da própria loja, pra quem já usa hoje continuar entrando com
-- a mesma loja + mesmo PIN (só que agora digitando o nome da loja como "nome").
-- encomenda_caixa_pins fica órfã (não é dropada aqui) -- remover depois de
-- confirmar que ninguém mais depende dela.

insert into caixas (name, store_id, pin_hash, failed_pin_attempts, pin_locked_until)
select s.name, e.store_id, e.pin_hash, e.failed_pin_attempts, e.pin_locked_until
from encomenda_caixa_pins e
join stores s on s.id = e.store_id
where e.pin_hash is not null
on conflict (name) do nothing;
