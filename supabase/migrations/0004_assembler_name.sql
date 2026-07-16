-- Nome de quem efetivamente vai fazer a montagem/desmontagem no local, preenchido
-- pela assistência depois que despacham alguém. Diferente de "assigned_to", que é
-- quem da assistência está gerenciando o chamado dentro do sistema.

alter table service_requests add column if not exists assembler_name text;
