-- Tela de KPIs logísticos (07/10/2026): views + RPC kpis_logistica, servida
-- por GET /api/logistica/v1/kpis/logistica. Aplicada no Supabase
-- self-hosted em 07/10/2026, depois da 0156 (itens das cargas). Definições e
-- contrato em lojas-maia-integracao/apis/logistica-v1/ (kpis-logistica.md,
-- openapi.yaml; este arquivo é cópia de sql/0157_kpis_logistica.sql).
--
-- Fontes, todas já no Supabase self-hosted:
--   totvs_delivery_cargas  (1 linha por pedido x carga; vem do /ai/deliveries)
--   totvs_deliveries       (pedido, cliente, CPF)
--   totvs_orders           (NF de venda e de devolução)
--   service_requests       (chamados da assistência, só no nosso sistema)
--   totvs_delivery_carga_itens (0156: o sync grava os itens que a API já devolve)
-- Novas aqui: produto_porte, produto_porte_regras e as views.
--
-- Decisões do Victor (07/10/2026):
--   - motorista 000058 (LOJAS MAIA TREINAMENTO) fica fora de tudo;
--   - L06 (pedido não foi carregado) é falha do CD: sai do índice de logística
--     do motorista e aparece à parte como "cd";
--   - atribuição por CPF aprovada, com ressalva na tela.

------------------------------------------------------------------------------
-- 1. Porte do produto (P/M/G)
-- O Protheus tem o m³ por item (ZAF_VOLUM3), mas a API não expõe. Até lá, o
-- porte vem de regras por descrição; produto_porte guarda a exceção manual
-- (e o m³, quando chegar), e sempre vence a regra.
------------------------------------------------------------------------------
create table if not exists produto_porte_regras (
  padrao text primary key,             -- LIKE sobre upper(descricao)
  porte text not null check (porte in ('P', 'M', 'G')),
  prioridade integer not null default 100  -- menor vence
);

create table if not exists produto_porte (
  produto text primary key,
  porte text not null check (porte in ('P', 'M', 'G')),
  origem text not null check (origem in ('manual', 'm3')),
  m3 numeric(10,4),
  atualizado_em timestamptz not null default now(),
  atualizado_por text
);

alter table produto_porte_regras enable row level security;
alter table produto_porte enable row level security;
grant select, insert, update, delete on public.produto_porte_regras to service_role;
grant select, insert, update, delete on public.produto_porte to service_role;

-- Semente tirada das descrições vendidas nos últimos 60 dias (07/10/2026).
-- As mais específicas têm prioridade menor (ex.: KIT COZINHA antes de KIT).
insert into produto_porte_regras (padrao, porte, prioridade) values
  ('%GUARDA ROUPA%', 'G', 10), ('ROUPEIRO%', 'G', 10), ('%SOFA%', 'G', 10),
  ('%COZINHA%', 'G', 10), ('%SUPER BOX%', 'G', 10), ('SUPERBOX%', 'G', 10),
  ('%BOX%', 'G', 20), ('COLCHAO%', 'G', 20), ('COL %', 'G', 20),
  ('%BASE %', 'G', 20), ('BAU %', 'G', 20), ('%BELICHE%', 'G', 20),
  ('%CAMA %', 'G', 30), ('%GELADEIRA%', 'G', 10), ('%REFRIGERADOR%', 'G', 10),
  ('%LAVADORA%', 'G', 10),
  ('%MESA APOIO%', 'P', 10), ('KIT % ESP%', 'P', 10),
  ('%AEREO%', 'M', 40), ('CABECEIRA%', 'M', 40), ('COMODA%', 'M', 40),
  ('MESA%', 'M', 40), ('HOME%', 'M', 40), ('BALCAO%', 'M', 40),
  ('PANELEIRO%', 'M', 40), ('ARMARIO%', 'M', 40), ('MULTI%USO%', 'M', 40),
  ('POLTRONA%', 'M', 40), ('JOGO % CADEIRAS%', 'M', 40), ('%ESTANTE%', 'M', 40),
  ('%RACK%', 'M', 40), ('%PAINEL%', 'M', 40), ('%SAPATEIRA%', 'M', 40),
  ('ROUP %', 'G', 10), ('COMP COZ%', 'G', 10), ('CONJUNTO HOME%', 'G', 10),
  ('COLCHONETE%', 'P', 15), ('%ENCOSTO%', 'P', 15),
  ('%CADEIRAS%', 'M', 35), ('% 2 CAD %', 'M', 35), ('CRISTALEIRA%', 'M', 40),
  ('TORRE %', 'M', 40), ('BUFFET%', 'M', 40), ('BANCADA%', 'M', 40),
  ('PENTEADEIRA%', 'M', 40), ('APARADOR%', 'M', 40),
  ('CADEIRA%', 'P', 50), ('PROTETOR%', 'P', 50), ('TRAVESSEIRO%', 'P', 50),
  ('TRAV %', 'P', 50), ('ESPUMA%', 'P', 50), ('KIT %', 'P', 60)
on conflict (padrao) do nothing;

create or replace view v_produto_porte with (security_invoker = true) as
select d.produto,
       coalesce(pp.porte, r.porte, 'N') as porte,          -- N = não classificado
       case when pp.porte is not null then pp.origem
            when r.porte is not null then 'regra'
            else 'nenhuma' end as origem
from (select distinct produto, max(descricao) as descricao
        from totvs_delivery_carga_itens group by produto) d
left join produto_porte pp on pp.produto = d.produto
left join lateral (
  -- "FL " é prefixo de linha de produto (FL ROUPEIRO, FL MESA...), não o tipo.
  select porte from produto_porte_regras
   where regexp_replace(upper(d.descricao), '^FL\s+', '') like padrao
   order by prioridade, length(padrao) desc
   limit 1
) r on true;

------------------------------------------------------------------------------
-- 2. CPF só com dígitos, para ligar entrega x devolução x assistência
------------------------------------------------------------------------------
create index if not exists totvs_deliveries_cpf_digitos_idx
  on totvs_deliveries ((regexp_replace(client_cpf_cnpj, '\D', '', 'g')));
create index if not exists totvs_orders_cpf_digitos_idx
  on totvs_orders ((regexp_replace(client_cpf_cnpj, '\D', '', 'g'))) where type = 'Devolucao';
-- Índice de expressão nasce sem estatística e o autoanalyze só roda quando as
-- linhas mudam: sem isto a RPC levou 16 s no teste (com, 41 ms).
analyze totvs_deliveries;
analyze totvs_orders;

------------------------------------------------------------------------------
-- 3. Views
------------------------------------------------------------------------------

-- Base de todas as views: cargas de produção, sem contas de teste.
create or replace view v_cargas_producao with (security_invoker = true) as
select * from totvs_delivery_cargas
where coalesce(motorista_codigo, '') not in ('000058');  -- LOJAS MAIA TREINAMENTO


-- Um nome por código: o Protheus às vezes manda o nome vazio para o mesmo código.
create or replace view v_motoristas_protheus with (security_invoker = true) as
select motorista_codigo as codigo,
       (array_agg(motorista_nome order by updated_at desc)
          filter (where coalesce(trim(motorista_nome), '') <> ''))[1] as nome,
       count(distinct carga) as cargas
from v_cargas_producao
where coalesce(motorista_codigo, '') <> ''
group by motorista_codigo;

-- Uma linha por carga. "Dia" = ZAG_DTPREV (previsão definida pelo CD), que é
-- única por carga e bate com o volume do Pedro (~14 cargas/dia). Quando a API
-- expuser ZAG_DTLIBE (liberação), trocar aqui. Datas digitadas erradas
-- (ex.: 7324-10-07) ficam de fora.
create or replace view v_cargas_logistica with (security_invoker = true) as
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
group by c.carga;

create or replace view v_carga_portes with (security_invoker = true) as
select dc.carga,
       sum(i.quantidade) filter (where p.porte = 'P') as qtd_p,
       sum(i.quantidade) filter (where p.porte = 'M') as qtd_m,
       sum(i.quantidade) filter (where p.porte = 'G') as qtd_g,
       sum(i.quantidade) filter (where p.porte = 'N') as qtd_nao_classificado
from totvs_delivery_carga_itens i
join v_cargas_producao dc on dc.id = i.delivery_carga_id
join v_produto_porte p on p.produto = i.produto
group by dc.carga;

-- Visitas: cada passagem de um pedido numa carga com resultado de entrega.
create or replace view v_visitas_motorista with (security_invoker = true) as
select c.id as delivery_carga_id, c.carga, c.motorista_codigo, c.dt_retorno as dia,
       c.status_entrega_codigo, c.tentativa, c.ocorrencia_codigo,
       regexp_replace(d.client_cpf_cnpj, '\D', '', 'g') as cpf
from v_cargas_producao c
join totvs_deliveries d on d.id = c.delivery_id
where c.status_origem = 'ENTREGA'
  and c.status_entrega_codigo in ('1', '2', '3')
  and coalesce(c.motorista_codigo, '') <> '';

-- Eventos de "volta", cada um atribuído a um motorista do Protheus.
--   insucesso / parcial ...... direto da carga
--   devolucao ................ NF de devolução até 30 dias depois de uma entrega
--                              ao mesmo CPF (motorista da entrega mais recente)
--   assistencia .............. chamado pós-entrega: pela carga informada em
--                              causa_carga (atribuição forte) ou, sem ela, pela
--                              entrega mais recente ao mesmo CPF nos 30 dias antes
create or replace view v_volta_eventos with (security_invoker = true) as
select 'insucesso'::text as tipo, v.motorista_codigo, v.dia, v.carga,
       left(v.ocorrencia_codigo, 1) as categoria, v.ocorrencia_codigo as detalhe,
       'carga'::text as atribuicao
from v_visitas_motorista v where v.status_entrega_codigo = '3'
union all
select 'parcial', v.motorista_codigo, v.dia, v.carga, null, null, 'carga'
from v_visitas_motorista v where v.status_entrega_codigo = '2'
union all
select 'devolucao', e.motorista_codigo, o.issue_date, e.carga, null, o.invoice, 'cpf_30d'
from totvs_orders o
cross join lateral (
  select v.motorista_codigo, v.carga from v_visitas_motorista v
   where v.cpf = regexp_replace(o.client_cpf_cnpj, '\D', '', 'g')
     and v.status_entrega_codigo in ('1', '2')
     and v.dia between o.issue_date - 30 and o.issue_date
   order by v.dia desc limit 1
) e
where o.type = 'Devolucao'
union all
select 'assistencia', coalesce(pc.motorista_codigo, e.motorista_codigo), s.created_at::date,
       coalesce(pc.carga, e.carga), s.causa_raiz, s.type,
       case when pc.carga is not null then 'causa_carga' else 'cpf_30d' end
from service_requests s
left join lateral (
  select c.motorista_codigo, c.carga from v_cargas_producao c
   where c.carga = s.causa_carga and coalesce(c.motorista_codigo, '') <> '' limit 1
) pc on true
left join lateral (
  select v.motorista_codigo, v.carga from v_visitas_motorista v
   where v.cpf = regexp_replace(s.client_cpf, '\D', '', 'g')
     and v.status_entrega_codigo in ('1', '2')
     and v.dia between s.created_at::date - 30 and s.created_at::date
   order by v.dia desc limit 1
) e on pc.carga is null
where s.status <> 'cancelada'
  and s.type in ('troca_produto', 'entrega_produto', 'recolhimento_produto', 'recolhimento',
                 'envio_peca', 'troca_peca', 'envio_recolhimento_peca')
  and coalesce(pc.motorista_codigo, e.motorista_codigo) is not null;

-- security_invoker (padrão do projeto) + revoke: as views leem tabelas com RLS
-- e CPF; só o service_role (e a RPC abaixo) pode ler.
revoke all on v_produto_porte, v_cargas_producao, v_motoristas_protheus, v_cargas_logistica,
  v_carga_portes, v_visitas_motorista, v_volta_eventos from anon, authenticated;
grant select on v_produto_porte, v_cargas_producao, v_motoristas_protheus, v_cargas_logistica,
  v_carga_portes, v_visitas_motorista, v_volta_eventos to service_role;
revoke all on produto_porte_regras, produto_porte from anon, authenticated;

------------------------------------------------------------------------------
-- 4. RPC da tela: uma ida ao banco, devolve o JSON do contrato /kpis/logistica
------------------------------------------------------------------------------
create or replace function kpis_logistica(p_de date, p_ate date, p_tipo text default null)
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
         count(*) filter (where status_entrega_codigo = '1') as entregues
  from v_visitas_motorista where dia between p_de and p_ate group by 1
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
  from v_volta_eventos where dia between p_de and p_ate group by 1
),
motoristas as (
  select m.codigo, m.nome, coalesce(v.visitas, 0) as visitas, coalesce(v.entregues, 0) as entregues,
         coalesce(x.insucessos, 0) as insucessos, coalesce(x.insucessos_cliente, 0) as insucessos_cliente,
         coalesce(x.insucessos_logistica, 0) as insucessos_logistica, coalesce(x.insucessos_cd, 0) as insucessos_cd,
         coalesce(x.insucessos_outros, 0) as insucessos_outros,
         coalesce(x.parciais, 0) as parciais, coalesce(x.devolucoes, 0) as devolucoes,
         coalesce(x.assistencias, 0) as assistencias, coalesce(x.assistencias_por_carga, 0) as assistencias_por_carga,
         coalesce(x.assistencias_transporte, 0) as assistencias_transporte,
         (select count(*) from cargas c where c.motorista_codigo = m.codigo) as cargas
  from v_motoristas_protheus m
  left join visitas v on v.motorista_codigo = m.codigo
  left join voltas x on x.motorista_codigo = m.codigo
  where v.visitas > 0 or x.motorista_codigo is not null
)
select jsonb_build_object(
  'periodo', jsonb_build_object('de', p_de, 'ate', p_ate, 'tipo', p_tipo),
  'cargasPorDia', coalesce((
    select jsonb_agg(jsonb_build_object('dia', dia, 'cargas', n, 'pedidos', pedidos) order by dia)
    from (select dia, count(*) as n, sum(pedidos) as pedidos from cargas group by dia) d), '[]'::jsonb),
  'cargas', coalesce((
    select jsonb_agg(jsonb_build_object(
      'carga', carga, 'dia', dia, 'tipo', tipo, 'veiculo', veiculo,
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
      'insucessos', jsonb_build_object('total', insucessos, 'cliente', insucessos_cliente,
                                       'logistica', insucessos_logistica, 'cd', insucessos_cd,
                                       'outros', insucessos_outros),
      'parciais', parciais, 'devolucoes', devolucoes,
      'assistencias', jsonb_build_object('total', assistencias, 'porCarga', assistencias_por_carga,
                                         'porCpf', assistencias - assistencias_por_carga,
                                         'transporte', assistencias_transporte),
      'indiceVolta', case when visitas = 0 then null
        else round((insucessos + parciais + devolucoes + assistencias)::numeric / visitas, 4) end,
      'indiceVoltaLogistica', case when visitas = 0 then null
        else round((insucessos_logistica + assistencias_transporte)::numeric / visitas, 4) end)
      order by visitas desc)
    from motoristas), '[]'::jsonb)
);
$$;

revoke execute on function kpis_logistica(date, date, text) from public, anon, authenticated;
grant execute on function kpis_logistica(date, date, text) to service_role;
