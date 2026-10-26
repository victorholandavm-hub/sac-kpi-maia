-- (26/10/2026) /avaliacoes (e /kpis) davam React #441 por statement timeout
-- (8 s): cada página de v_ticket_enriched levava ~6,5 s, e a tela pede ~6 em
-- paralelo. O custo era is_recurrence: um EXISTS sobre o CTE "base" pra cada
-- linha (5.542 x 5.542, sem índice), que cresce com o quadrado dos
-- atendimentos. Agora a reincidência vem de um CTE com junção por igualdade
-- (contato + categoria) -- mesma regra, mesmo resultado. A view era mantida
-- direto no banco (fora das migrações); esta é a definição em produção em
-- 26/10 com só esse trecho trocado. Colunas, ordem e security_invoker iguais.
create or replace view v_ticket_enriched with (security_invoker = true) as
 WITH base AS (
         SELECT k.conversation_id,
            k.ghl_conversation_id,
            k.contact_id,
            k.opened_at,
            k.resolved_at,
            k.resolution_hours,
            k.store_tag,
            COALESCE(k.category_tag, ai.category_ai) AS category,
            COALESCE(k.product_tag, ai.product_ai) AS product,
            k.resolved_at IS NOT NULL AS resolved_by_tag,
            COALESCE(ai.resolved_ai, false) AS resolved_by_ai,
            k.resolved_at IS NOT NULL OR COALESCE(ai.resolved_ai, false) AS resolved_effective,
            COALESCE(ai.urgency_ai, 'baixa'::text) AS urgency,
            ai.summary_ai,
            c.assigned_to_id,
            c.channel,
            c.first_response_minutes,
            k.blocking_tag,
            k.blocking_since
           FROM v_ticket_kpi k
             LEFT JOIN conversation_ai_insight ai ON ai.conversation_id = k.conversation_id
             JOIN conversations c ON c.id = k.conversation_id
        ), recorrentes AS (
         -- Mesma regra de antes (atendimento aberto até recurrence_days depois de
         -- outro já resolvido, do mesmo contato e categoria), mas cruzando só
         -- os atendimentos do mesmo contato+categoria (junção por igualdade,
         -- hash) em vez de varrer a lista inteira pra cada linha.
         SELECT DISTINCT b1.conversation_id
           FROM base b1
             JOIN base b2 ON b2.contact_id = b1.contact_id AND b2.category = b1.category
          WHERE b2.resolved_at IS NOT NULL AND b2.resolved_at < b1.opened_at
            AND b1.opened_at <= (b2.resolved_at + (((( SELECT app_config.value
                   FROM app_config
                  WHERE app_config.key = 'recurrence_days'::text)) || ' days'::text)::interval))
        )
 SELECT b.conversation_id,
    b.ghl_conversation_id,
    b.contact_id,
    b.opened_at,
    b.resolved_at,
    b.resolution_hours,
    b.store_tag,
    b.category,
    b.product,
    b.resolved_by_tag,
    b.resolved_by_ai,
    b.resolved_effective,
    b.urgency,
    b.summary_ai,
    b.assigned_to_id,
    b.channel,
    b.first_response_minutes,
    b.blocking_tag,
    b.blocking_since,
    ag.name AS agent_name,
    COALESCE(ag.is_sac_agent, false) AS is_sac_agent,
    b.first_response_minutes IS NOT NULL AND b.first_response_minutes <= (( SELECT app_config.value::numeric AS value
           FROM app_config
          WHERE app_config.key = 'sla_minutes'::text)) AS within_sla,
    (EXISTS ( SELECT 1 FROM recorrentes r WHERE r.conversation_id = b.conversation_id)) AS is_recurrence
   FROM base b
     LEFT JOIN agents ag ON ag.id = b.assigned_to_id;
