-- Classificação por IA das conversas do SAC -- mesmo padrão do nps_score em
-- 0069 (conversations é mantida fora deste repo, mas colunas nossas entram
-- normalmente via migration). Usado quando a categoria do GHL é genérica
-- ("Dúvida") ou quando produto/loja não vieram marcados pelo atendente --
-- ver src/lib/ticketClassification.ts e a rota /api/sync-ai-classify.
alter table conversations add column if not exists ai_category text;
alter table conversations add column if not exists ai_product text;
alter table conversations add column if not exists ai_store_tag text;
alter table conversations add column if not exists ai_confidence text
  check (ai_confidence is null or ai_confidence in ('alta', 'media', 'baixa'));
alter table conversations add column if not exists ai_analyzed_at timestamptz;
alter table conversations add column if not exists ai_model text;

-- Fila de pendentes (nunca analisadas) -- consultada a cada rodada da rota
-- de classificação, mesmo padrão de idx parcial que o projeto já usa pra
-- filas de trabalho.
create index if not exists idx_conversations_ai_pending
  on conversations (ai_analyzed_at)
  where ai_analyzed_at is null;
