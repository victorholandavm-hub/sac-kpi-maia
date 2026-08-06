-- NPS coletado via workflow do GHL: quando o atendente marca resolvido, um
-- template de enquete é disparado pro cliente pelo WhatsApp perguntando
-- "de 1 a 5, qual nota você dá pro nosso atendimento" (1 = muito
-- insatisfeito, 5 = muito satisfeito). A resposta chega como mensagem
-- inbound comum na própria conversa -- sync/route.ts varre as mensagens
-- procurando esse padrão (ver detectNpsScore) e grava aqui.
alter table conversations add column if not exists nps_score smallint
  check (nps_score is null or (nps_score >= 1 and nps_score <= 5));
alter table conversations add column if not exists nps_answered_at timestamptz;
