-- (08/10/2026) Índice de Assistência consolidado: todas as frentes de
-- pós-venda, não só o pedido de peça. Aplicada no Supabase self-hosted em
-- 08/10/2026. Original em
-- lojas-maia-integracao/apis/logistica-v1/sql/0159_assistencia_pos_venda.sql.
--
-- Frentes (pedido do Victor, 08/10/2026), por service_requests.type:
--   peca ............ envio_peca, troca_peca, envio_recolhimento_peca
--                     + pedidos da fila de peças (part_orders)
--   troca_produto ... troca_produto
--   recolhimento .... recolhimento_produto, recolhimento
--   entrega_produto . entrega_produto (produto novo por causa da assistência)
-- Montagem, desmontagem e vistoria ficam fora (não são retorno de entrega).
--
-- Uma ocorrência conta uma vez:
--   - chamado filho (parent_request_id: troca refeita, reenvio) é rodada da
--     mesma ocorrência; conta só o raiz;
--   - pedido de peça que aponta para um chamado de peça, ou que tem um
--     chamado de peça do mesmo CPF em até 30 dias, é o mesmo caso visto pela
--     fila de peças; conta o chamado.
--
-- Vínculo com a entrega, em cascata (mesma regra da 0158, mais a carga):
--   carga ........... carga informada no chamado (causa_carga)
--   nf .............. NF de venda do chamado/pedido é a de uma entrega ao
--                     mesmo cliente
--   cpf / codigo_cliente  entrega mais recente ao mesmo cliente (CPF ou
--                     código do Protheus) nos 180 dias antes
--
-- O Índice de Volta (0157) não muda: continua com as assistências pela
-- regra de 30 dias. O índice consolidado sai à parte, como indiceAssistencia.

create or replace view v_assistencias_entrega with (security_invoker = true) as
with ocorrencias as (
  select 'chamado'::text as origem, s.id, s.ticket_number, s.type as tipo,
         case when s.type in ('envio_peca', 'troca_peca', 'envio_recolhimento_peca') then 'peca'
              when s.type = 'troca_produto' then 'troca_produto'
              when s.type in ('recolhimento_produto', 'recolhimento') then 'recolhimento'
              else 'entrega_produto' end as frente,
         s.status, s.created_at::date as dia, s.causa_raiz,
         s.client_cpf as cpf_bruto, s.invoice_number as nf_bruta,
         s.client_protheus_code as codigo, s.causa_carga
  from service_requests s
  where s.status <> 'cancelada'
    and s.parent_request_id is null
    and s.type in ('envio_peca', 'troca_peca', 'envio_recolhimento_peca', 'troca_produto',
                   'recolhimento_produto', 'recolhimento', 'entrega_produto')
  union all
  select 'pedido_peca', po.id, po.ticket_number, 'pedido_peca', 'peca',
         po.status, po.created_at::date, null,
         po.client_cpf, po.invoice_number, null, null
  from part_orders po
  where po.status <> 'cancelada'
    and not exists (
      select 1 from service_requests s
       where s.status <> 'cancelada'
         and s.type in ('envio_peca', 'troca_peca', 'envio_recolhimento_peca')
         and (s.id = po.service_request_id
              or (nullif(regexp_replace(coalesce(po.client_cpf, ''), '\D', '', 'g'), '')
                    = regexp_replace(coalesce(s.client_cpf, ''), '\D', '', 'g')
                  and s.created_at between po.created_at - interval '30 days'
                                       and po.created_at + interval '30 days')))
)
select o.origem, o.id, o.ticket_number, o.tipo, o.frente, o.status, o.dia, o.causa_raiz,
       coalesce(pc.motorista_codigo, e.motorista_codigo) as motorista_codigo,
       coalesce(pc.carga, e.carga) as carga,
       coalesce(pc.dia, e.dia) as dia_entrega,
       case when pc.carga is not null then 'carga' else e.atribuicao end as atribuicao
from ocorrencias o
cross join lateral (
  select nullif(regexp_replace(coalesce(o.cpf_bruto, ''), '\D', '', 'g'), '') as cpf,
         nullif(ltrim(regexp_replace(coalesce(o.nf_bruta, ''), '\D', '', 'g'), '0'), '') as nf
) k
cross join lateral (
  select array_remove(array_agg(tc.protheus_code) || o.codigo, null) as codigos
  from totvs_clientes tc where tc.cpf_cnpj = k.cpf
) cc
left join lateral (
  select c.motorista_codigo, c.carga, c.dt_retorno as dia from v_cargas_producao c
   where c.carga = o.causa_carga and coalesce(c.motorista_codigo, '') <> ''
   order by c.dt_retorno desc nulls last
   limit 1
) pc on true
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
    and v.dia <= o.dia
    and (v.nota_fiscal = k.nf or v.dia >= o.dia - 180)
  order by (v.nota_fiscal = k.nf) is true desc, v.dia desc
  limit 1
) e on pc.carga is null;

revoke all on v_assistencias_entrega from anon, authenticated;
grant select on v_assistencias_entrega to service_role;

------------------------------------------------------------------------------
-- RPC: mesma assinatura da 0158; acrescenta posVenda / indiceAssistencia por
-- motorista e posVendaPeriodo no topo. Os campos pecas / indicePecas ficam
-- (contrato publicado), calculados como antes.
------------------------------------------------------------------------------
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
pos_venda_periodo as materialized (
  select * from v_assistencias_entrega where dia between p_de and p_ate
),
pos_venda as (
  select motorista_codigo, count(*) as pv_total,
         count(*) filter (where frente = 'peca') as pv_peca,
         count(*) filter (where frente = 'troca_produto') as pv_troca,
         count(*) filter (where frente = 'recolhimento') as pv_recolhimento,
         count(*) filter (where frente = 'entrega_produto') as pv_entrega,
         count(*) filter (where atribuicao = 'carga') as pv_por_carga,
         count(*) filter (where atribuicao = 'nf') as pv_por_nf
  from pos_venda_periodo
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
         coalesce(pv.pv_total, 0) as pv_total, coalesce(pv.pv_peca, 0) as pv_peca,
         coalesce(pv.pv_troca, 0) as pv_troca, coalesce(pv.pv_recolhimento, 0) as pv_recolhimento,
         coalesce(pv.pv_entrega, 0) as pv_entrega, coalesce(pv.pv_por_carga, 0) as pv_por_carga,
         coalesce(pv.pv_por_nf, 0) as pv_por_nf,
         (select count(*) from cargas c where c.motorista_codigo = m.codigo) as cargas
  from v_motoristas_protheus m
  left join visitas v on v.motorista_codigo = m.codigo
  left join voltas x on x.motorista_codigo = m.codigo
  left join pecas pc on pc.motorista_codigo = m.codigo
  left join pos_venda pv on pv.motorista_codigo = m.codigo
  where v.visitas > 0 or x.motorista_codigo is not null or pc.motorista_codigo is not null
     or pv.motorista_codigo is not null
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
        else round(pecas::numeric / entregas_realizadas, 4) end,
      'posVenda', jsonb_build_object('total', pv_total, 'pecas', pv_peca, 'trocaProduto', pv_troca,
                                     'recolhimento', pv_recolhimento, 'entregaProduto', pv_entrega,
                                     'porCarga', pv_por_carga, 'porNf', pv_por_nf,
                                     'porCliente', pv_total - pv_por_carga - pv_por_nf),
      'indiceAssistencia', case when entregas_realizadas = 0 then null
        else round(pv_total::numeric / entregas_realizadas, 4) end)
      order by visitas desc)
    from motoristas), '[]'::jsonb),
  -- pedidos de peça do período (sem filtro de veículo): quantos acharam a entrega
  'pecasPeriodo', (
    select jsonb_build_object('total', count(*),
                              'vinculadas', count(*) filter (where motorista_codigo is not null))
    from pecas_periodo),
  -- ocorrências de pós-venda do período (sem filtro de veículo), por frente
  'posVendaPeriodo', (
    select jsonb_build_object('total', count(*),
                              'vinculadas', count(*) filter (where motorista_codigo is not null),
                              'pecas', count(*) filter (where frente = 'peca'),
                              'trocaProduto', count(*) filter (where frente = 'troca_produto'),
                              'recolhimento', count(*) filter (where frente = 'recolhimento'),
                              'entregaProduto', count(*) filter (where frente = 'entrega_produto'))
    from pos_venda_periodo)
);
$$;

revoke execute on function kpis_logistica(date, date, text, text) from public, anon, authenticated;
grant execute on function kpis_logistica(date, date, text, text) to service_role;
