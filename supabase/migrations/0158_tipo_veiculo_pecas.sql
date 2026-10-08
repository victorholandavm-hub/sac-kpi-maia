-- (08/10/2026) Tipo de veículo (Carro x Caminhão) e fila de peças da
-- assistência ligada ao motorista da entrega. Aplicada no Supabase
-- self-hosted em 08/10/2026. Original em
-- lojas-maia-integracao/apis/logistica-v1/sql/0158_tipo_veiculo_pecas.sql.
--
-- Regras confirmadas pelo Victor (08/10/2026):
--   - as Fiat Strada do Eduardo, do Joalison e do Joanderson têm placa fixa;
--     o resto da frota conta como Caminhão;
--   - o pedido de peça (part_orders, /assistencia/fila?tab=pecas) se liga à
--     entrega pelo CPF e pelo código do cliente no Protheus.
--
-- Placas tiradas do histórico de cargas (v_cargas_logistica, jun-out/2026):
--   TPB0A58  Eduardo (000045)    83 cargas, ~3 pedidos/carga
--   TPB0A38  Joalison (000010)   80 cargas, ~3 pedidos/carga
--   TPA9E88  Joanderson (000054) 67 cargas, ~3 pedidos/carga
--   TPA9E78  sem motorista fixo: os três usam (22 cargas), e também Marcos
--            Vinicius, Isaac e Douglas; mesmo perfil (2-3 pedidos/carga).
-- As cargas antigas trazem a placa cortada em 6 letras (TPB0A5, TPA9E8...).

------------------------------------------------------------------------------
-- 1. Veículos
------------------------------------------------------------------------------
create table if not exists veiculos_logistica (
  placa text primary key,
  tipo_veiculo text not null check (tipo_veiculo in ('Carro', 'Caminhão')),
  modelo text,
  motorista_codigo text,               -- motorista fixo do veículo, quando há
  observacao text,
  atualizado_em timestamptz not null default now()
);

alter table veiculos_logistica enable row level security;
revoke all on veiculos_logistica from anon, authenticated;
grant select, insert, update, delete on public.veiculos_logistica to service_role;

insert into veiculos_logistica (placa, tipo_veiculo, modelo, motorista_codigo, observacao) values
  ('TPB0A58', 'Carro', 'Fiat Strada', '000045', 'Eduardo Henrique'),
  ('TPB0A38', 'Carro', 'Fiat Strada', '000010', 'Joalison Ferreira'),
  ('TPA9E88', 'Carro', 'Fiat Strada', '000054', 'Joanderson'),
  ('TPA9E78', 'Carro', 'Fiat Strada', null, 'Sem motorista fixo; perfil de carro no histórico')
on conflict (placa) do nothing;

------------------------------------------------------------------------------
-- 2. Views (colunas novas sempre no fim: create or replace exige)
------------------------------------------------------------------------------

-- tipo_veiculo: pela placa da carga; quando a carga não traz placa (AIAM,
-- vazio), pelo motorista fixo do carro; senão Caminhão.
-- tipo_veiculo_origem: 'placa' | 'motorista' | 'padrao'.
create or replace view v_cargas_logistica with (security_invoker = true) as
select b.*,
       coalesce(vp.tipo_veiculo, vm.tipo_veiculo, 'Caminhão') as tipo_veiculo,
       case when vp.tipo_veiculo is not null then 'placa'
            when vm.tipo_veiculo is not null then 'motorista'
            else 'padrao' end as tipo_veiculo_origem
from (
  select c.carga,
         max(c.dt_previsao) filter (where c.dt_previsao between date '2020-01-01' and current_date + 365) as dia,
         mode() within group (order by c.tipo_entrega) as tipo,
         max(nullif(c.motorista_codigo, '')) as motorista_codigo,
         max(nullif(c.veiculo, '')) as veiculo,
         bool_or(c.status_origem = 'ENTREGA' or c.status_carga_codigo in ('5', '6')) as despachada,
         count(*) as pedidos,
         count(*) filter (where c.status_origem = 'ENTREGA' and c.status_entrega_codigo = '1') as entregues,
         count(*) filter (where c.status_origem = 'ENTREGA' and c.status_entrega_codigo = '2') as parciais,
         count(*) filter (where c.status_origem = 'ENTREGA' and c.status_entrega_codigo = '3') as nao_entregues,
         count(*) filter (where c.status_origem = 'ENTREGA' and c.status_entrega_codigo = '4') as canceladas
  from v_cargas_producao c
  group by c.carga
) b
left join lateral (
  select v.tipo_veiculo from veiculos_logistica v
   where v.placa = b.veiculo or (length(b.veiculo) = 6 and left(v.placa, 6) = b.veiculo)
   order by v.placa = b.veiculo desc
   limit 1
) vp on true
left join lateral (
  select v.tipo_veiculo from veiculos_logistica v
   where v.motorista_codigo = b.motorista_codigo
     and coalesce(b.veiculo, '') !~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{1,2}$'
   limit 1
) vm on true;

-- + nota_fiscal e client_id (código do cliente no Protheus) para ligar a peça.
create or replace view v_visitas_motorista with (security_invoker = true) as
select c.id as delivery_carga_id, c.carga, c.motorista_codigo, c.dt_retorno as dia,
       c.status_entrega_codigo, c.tentativa, c.ocorrencia_codigo,
       regexp_replace(d.client_cpf_cnpj, '\D', '', 'g') as cpf,
       ltrim(c.nota_fiscal, '0') as nota_fiscal,
       d.client_id
from v_cargas_producao c
join totvs_deliveries d on d.id = c.delivery_id
where c.status_origem = 'ENTREGA'
  and c.status_entrega_codigo in ('1', '2', '3')
  and coalesce(c.motorista_codigo, '') <> '';

create index if not exists totvs_deliveries_client_id_idx on totvs_deliveries (client_id);
analyze totvs_deliveries;

-- Um pedido de peça por linha, ligado à entrega que levou o produto.
-- Cliente = CPF do pedido de peça (ou do chamado) + códigos do Protheus
-- (totvs_clientes pelo CPF e client_protheus_code do chamado). Entre as
-- entregas a esse cliente antes do pedido:
--   atribuicao 'nf'             a NF de venda do pedido de peça é a da carga
--   atribuicao 'cpf' / 'codigo_cliente'  sem NF que bata, a entrega mais
--                               recente nos 180 dias anteriores
-- A NF sozinha não basta (o número se repete entre filiais): o cliente
-- tem que bater sempre. Sem entrega achada, motorista_codigo fica nulo.
create or replace view v_pecas_entrega with (security_invoker = true) as
select po.id as part_order_id, po.ticket_number, po.external_reference, po.status,
       po.created_at::date as dia, po.part_name, po.product,
       e.motorista_codigo, e.carga, e.dia as dia_entrega, e.atribuicao
from part_orders po
left join service_requests s on s.id = po.service_request_id
cross join lateral (
  select nullif(regexp_replace(coalesce(nullif(po.client_cpf, ''), s.client_cpf, ''), '\D', '', 'g'), '') as cpf,
         nullif(ltrim(regexp_replace(coalesce(nullif(po.invoice_number, ''), s.invoice_number, ''), '\D', '', 'g'), '0'), '') as nf
) k
cross join lateral (
  select array_remove(array_agg(tc.protheus_code) || s.client_protheus_code, null) as codigos
  from totvs_clientes tc where tc.cpf_cnpj = k.cpf
) cc
left join lateral (
  select v.motorista_codigo, v.carga, v.dia,
         case when v.nota_fiscal = k.nf then 'nf' else v.via end as atribuicao
  from (
    select v1.*, 'cpf'::text as via from v_visitas_motorista v1 where v1.cpf = k.cpf
    union all
    select v2.*, 'codigo_cliente' from v_visitas_motorista v2
     where v2.client_id = any (cc.codigos) and v2.cpf is distinct from k.cpf
  ) v
  where v.status_entrega_codigo in ('1', '2')
    and v.dia <= po.created_at::date
    and (v.nota_fiscal = k.nf or v.dia >= po.created_at::date - 180)
  order by (v.nota_fiscal = k.nf) is true desc, v.dia desc
  limit 1
) e on true
where po.status <> 'cancelada';

revoke all on v_pecas_entrega from anon, authenticated;
grant select on v_pecas_entrega to service_role;

------------------------------------------------------------------------------
-- 3. RPC: + p_tipo_veiculo (filtra cargas, visitas, voltas e peças pela carga)
--    e o Índice de Assistência de Peças por motorista.
-- Assinatura nova: troca a de 3 parâmetros (senão o PostgREST vê duas).
------------------------------------------------------------------------------
drop function if exists kpis_logistica(date, date, text);

create or replace function kpis_logistica(p_de date, p_ate date, p_tipo text default null,
                                          p_tipo_veiculo text default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
-- materialized: o planejador estima 1 carga no período (são ~300) e faria
-- nested loop recalculando motoristas e portes por carga (5 s em vez de ms).
with base as materialized (
  select c.* from v_cargas_logistica c
  where c.despachada and c.dia between p_de and p_ate
    and (p_tipo is null or c.tipo = p_tipo)
    and (p_tipo_veiculo is null or c.tipo_veiculo = p_tipo_veiculo)
),
-- cargas do tipo de veículo pedido, de qualquer data: visitas e voltas são
-- filtradas pela data delas, não pela da carga.
veic as materialized (
  select carga from v_cargas_logistica where p_tipo_veiculo is not null and tipo_veiculo = p_tipo_veiculo
),
nomes as materialized (select codigo, nome from v_motoristas_protheus),
portes as materialized (
  select p.* from v_carga_portes p where p.carga in (select carga from base)
),
cargas as (
  select c.*, m.nome as motorista_nome,
         coalesce(p.qtd_p, 0) as qtd_p, coalesce(p.qtd_m, 0) as qtd_m,
         coalesce(p.qtd_g, 0) as qtd_g, coalesce(p.qtd_nao_classificado, 0) as qtd_n
  from base c
  left join nomes m on m.codigo = c.motorista_codigo
  left join portes p on p.carga = c.carga
),
visitas as (
  select motorista_codigo, count(*) as visitas,
         count(*) filter (where status_entrega_codigo = '1') as entregues,
         count(*) filter (where status_entrega_codigo in ('1', '2')) as entregas_realizadas
  from v_visitas_motorista
  where dia between p_de and p_ate
    and (p_tipo_veiculo is null or carga in (select carga from veic))
  group by 1
),
voltas as (
  select motorista_codigo,
         count(*) filter (where tipo = 'insucesso') as insucessos,
         count(*) filter (where tipo = 'insucesso' and categoria = 'C') as insucessos_cliente,
         count(*) filter (where tipo = 'insucesso' and categoria = 'L' and detalhe <> 'L06') as insucessos_logistica,
         count(*) filter (where tipo = 'insucesso' and detalhe = 'L06') as insucessos_cd,
         count(*) filter (where tipo = 'insucesso' and coalesce(categoria, '') not in ('C', 'L')) as insucessos_outros,
         count(*) filter (where tipo = 'parcial') as parciais,
         count(*) filter (where tipo = 'devolucao') as devolucoes,
         count(*) filter (where tipo = 'assistencia') as assistencias,
         count(*) filter (where tipo = 'assistencia' and atribuicao = 'causa_carga') as assistencias_por_carga,
         count(*) filter (where tipo = 'assistencia' and categoria in ('erro_motorista', 'avaria_transporte')) as assistencias_transporte
  from v_volta_eventos
  where dia between p_de and p_ate
    and (p_tipo_veiculo is null or carga in (select carga from veic))
  group by 1
),
pecas_periodo as materialized (
  select * from v_pecas_entrega where dia between p_de and p_ate
),
pecas as (
  select motorista_codigo, count(*) as pecas,
         count(*) filter (where atribuicao = 'nf') as pecas_por_nf
  from pecas_periodo
  where motorista_codigo is not null
    and (p_tipo_veiculo is null or carga in (select carga from veic))
  group by 1
),
motoristas as (
  select m.codigo, m.nome, coalesce(v.visitas, 0) as visitas, coalesce(v.entregues, 0) as entregues,
         coalesce(v.entregas_realizadas, 0) as entregas_realizadas,
         coalesce(x.insucessos, 0) as insucessos, coalesce(x.insucessos_cliente, 0) as insucessos_cliente,
         coalesce(x.insucessos_logistica, 0) as insucessos_logistica, coalesce(x.insucessos_cd, 0) as insucessos_cd,
         coalesce(x.insucessos_outros, 0) as insucessos_outros,
         coalesce(x.parciais, 0) as parciais, coalesce(x.devolucoes, 0) as devolucoes,
         coalesce(x.assistencias, 0) as assistencias, coalesce(x.assistencias_por_carga, 0) as assistencias_por_carga,
         coalesce(x.assistencias_transporte, 0) as assistencias_transporte,
         coalesce(pc.pecas, 0) as pecas, coalesce(pc.pecas_por_nf, 0) as pecas_por_nf,
         (select count(*) from cargas c where c.motorista_codigo = m.codigo) as cargas
  from v_motoristas_protheus m
  left join visitas v on v.motorista_codigo = m.codigo
  left join voltas x on x.motorista_codigo = m.codigo
  left join pecas pc on pc.motorista_codigo = m.codigo
  where v.visitas > 0 or x.motorista_codigo is not null or pc.motorista_codigo is not null
)
select jsonb_build_object(
  'periodo', jsonb_build_object('de', p_de, 'ate', p_ate, 'tipo', p_tipo, 'tipoVeiculo', p_tipo_veiculo),
  'cargasPorDia', coalesce((
    select jsonb_agg(jsonb_build_object('dia', dia, 'cargas', n, 'pedidos', pedidos) order by dia)
    from (select dia, count(*) as n, sum(pedidos) as pedidos from cargas group by dia) d), '[]'::jsonb),
  'cargas', coalesce((
    select jsonb_agg(jsonb_build_object(
      'carga', carga, 'dia', dia, 'tipo', tipo, 'veiculo', veiculo,
      'tipoVeiculo', tipo_veiculo, 'tipoVeiculoOrigem', tipo_veiculo_origem,
      'motorista', case when motorista_codigo is null then null
                        else jsonb_build_object('codigo', motorista_codigo, 'nome', motorista_nome) end,
      'pedidos', pedidos, 'entregues', entregues, 'parciais', parciais,
      'naoEntregues', nao_entregues, 'canceladas', canceladas,
      'volumes', jsonb_build_object('P', qtd_p, 'M', qtd_m, 'G', qtd_g, 'naoClassificado', qtd_n))
      order by dia desc, carga)
    from cargas), '[]'::jsonb),
  'motoristas', coalesce((
    select jsonb_agg(jsonb_build_object(
      'codigo', codigo, 'nome', nome, 'cargas', cargas, 'visitas', visitas, 'entregues', entregues,
      'entregasRealizadas', entregas_realizadas,
      'insucessos', jsonb_build_object('total', insucessos, 'cliente', insucessos_cliente,
                                       'logistica', insucessos_logistica, 'cd', insucessos_cd,
                                       'outros', insucessos_outros),
      'parciais', parciais, 'devolucoes', devolucoes,
      'assistencias', jsonb_build_object('total', assistencias, 'porCarga', assistencias_por_carga,
                                         'porCpf', assistencias - assistencias_por_carga,
                                         'transporte', assistencias_transporte),
      'pecas', jsonb_build_object('total', pecas, 'porNf', pecas_por_nf, 'porCliente', pecas - pecas_por_nf),
      'indiceVolta', case when visitas = 0 then null
        else round((insucessos + parciais + devolucoes + assistencias)::numeric / visitas, 4) end,
      'indiceVoltaLogistica', case when visitas = 0 then null
        else round((insucessos_logistica + assistencias_transporte)::numeric / visitas, 4) end,
      'indicePecas', case when entregas_realizadas = 0 then null
        else round(pecas::numeric / entregas_realizadas, 4) end)
      order by visitas desc)
    from motoristas), '[]'::jsonb),
  -- pedidos de peça do período (sem filtro de veículo): quantos acharam a entrega
  'pecasPeriodo', (
    select jsonb_build_object('total', count(*),
                              'vinculadas', count(*) filter (where motorista_codigo is not null))
    from pecas_periodo)
);
$$;

revoke execute on function kpis_logistica(date, date, text, text) from public, anon, authenticated;
grant execute on function kpis_logistica(date, date, text, text) to service_role;
