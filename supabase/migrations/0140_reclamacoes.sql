-- Reclamações (Procon/Reclame Aqui/Judicial) -- pedido do Victor 28/09/2026:
-- nova aba "Reclamações", visível só pra admin, com a inteligência da
-- planilha RECLAMAÇÕES.xlsx (35 casos, extraída em 28/09/2026). Mesmo
-- espírito de estornos (migration 0135) -- histórico curado a partir de
-- planilha, sem sync automático (não existe API de Procon/Reclame Aqui/
-- processo judicial pra puxar isso sozinho) -- mas diferente de 0135
-- (log manual, sem tela de cadastro): esta já nasce com formulário na
-- tela pra registrar reclamação nova e atualizar status daqui pra frente,
-- a planilha para de ser a fonte de verdade a partir de agora.
--
-- status_interno/orgao continuam TEXT livre (sem check), mesmo motivo do
-- status em 0135_estornos.sql: não são enums fechados, novos órgãos
-- (outra cidade) ou status (jeito novo de descrever "ainda em aberto")
-- aparecem organicamente -- a tela oferece uma lista das opções mais
-- comuns + "Outro" com texto livre (ver reclamacoesLabels.ts), sem travar
-- no banco.
create table reclamacoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cpf text,
  orgao text not null,
  -- Data em que a reclamação chegou pra empresa -- vazia em toda a
  -- planilha de origem (nunca foi preenchida lá), mantida como coluna
  -- própria porque faz sentido registrar daqui pra frente.
  data_recebimento date,
  status_interno text not null default 'Falta responder',
  -- Status/andamento no próprio órgão (Procon/Reclame Aqui/processo) --
  -- texto livre, reflete a linguagem de cada um desses (ex.: "Audiência
  -- designada", "Condenação desfavorável"), não é controlado por nós.
  status_externo text,
  -- Data + hora da próxima audiência (quando existe) -- é o dado mais
  -- acionável da planilha original (várias linhas tinham data futura
  -- espalhada num campo de texto solto); vira coluna própria em
  -- timestamptz pra dar pra ordenar/alertar "próximas audiências" na
  -- tela, em vez de continuar escondida dentro de texto livre.
  data_audiencia timestamptz,
  -- Texto livre -- nome de arquivo/nota sobre documentos anexados, igual
  -- vinha na planilha original (não é upload de arquivo de verdade, só
  -- registro por texto).
  documentos text,
  recebido_por text,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_reclamacoes_status_interno on reclamacoes (status_interno);
create index idx_reclamacoes_orgao on reclamacoes (orgao);
create index idx_reclamacoes_data_audiencia on reclamacoes (data_audiencia);
create index idx_reclamacoes_cpf on reclamacoes (cpf);

alter table reclamacoes enable row level security;

-- Mesmo padrão de 0135/0139: só select pra authenticated (a página em si
-- já trava por role="admin" no app, ver dal.ts); todo write passa por
-- server action com getSupabaseAdmin() (service role), sem policy de
-- insert/update de propósito.
create policy reclamacoes_select_authenticated on reclamacoes for select to authenticated using (true);

insert into reclamacoes
  (nome, cpf, orgao, status_interno, status_externo, data_audiencia, documentos, recebido_por, observacoes)
values
('Marcos Rocha', null, 'Reclame Aqui', 'Resolvido', 'RESPONDIDO', null, null, null, null),
('Livia Carvalho', null, 'Reclame Aqui', 'Resolvido', 'RESPONDIDO', null, null, null, null),
('HILDEYDSON OLIVEIRA BARRETO', '103.557.114-51', 'Procon Estadual da Paraíba', 'Resolvido', 'RESPONDIDO', null, 'Hildeydson - RESPONDIDO EM 24/07 - em andamento', null, null),
('Adgilene Aguiar da Silva', '109.116.744-38', 'Procon Estadual da Paraíba', 'Resolvido', 'RESPONDIDO', null, 'Agdilene - RESPONDIDO E ESTORNADO', null, null),
('JOSÉ NILSON AMARO DA SILVA', '977.586.474-72', 'Procon Municipal de Bayeux', 'Resolvido', 'RESPONDIDO', null, 'JOSE NILSON - RESOLVIDO', null, null),
('Sergio Murilo Nunes', '069.476.318-74', 'Procon Municipal de João Pessoa', 'Resolvido', 'RESPONDIDO', '2026-07-15 10:00:00-03', 'Sergio Murilo - RESOLVIDO', null, null),
('ARNALDO ALVES PINHEIRO', '203.062.964-20', 'Procon Estadual da Paraíba', 'Resolvido', 'RESPONDIDO', null, 'Arnaldo - ESTORNADO', null, null),
('ELLEN JULIANA DA SILVA ALVES', '718.733.434-69', 'Procon Estadual da Paraíba', 'Resolvido', 'RESPONDIDO', null, 'Ellen - RESPONDIDO', null, null),
('Suelande Batista Da Silva', '892.562.044-87', 'Procon Municipal de João Pessoa', 'Resolvido', 'RESPONDIDO E ARQUIVADO DEVIDO AUSENCIA DA RECLAMANTE NA AUDIENCIA', '2026-06-25 09:00:00-03', 'SUELANDE - RESOLVIDO', null, null),
('Ariadne Carneiro de Mesquita', '088.696.844-58', 'Procon Municipal de João Pessoa', 'Resolvido', 'RESPONDIDO E ARQUIVADO DEVIDO AUSENCIA DA RECLAMANTE NA AUDIENCIA', '2026-07-31 14:00:00-03', 'Ariadne - AUDIÊNCIA PROCON 31/07', null, null),
('Vanessa Soares dos Santos', '718.482.064-96', 'Procon Municipal de João Pessoa', 'Resolvido', 'RESPONDIDO E ARQUIVADO DEVIDO AUSENCIA DA RECLAMANTE NA AUDIENCIA', '2026-08-12 09:00:00-03', 'Vanessa - AUDIÊNCIA PROCON 12/08 | - Acordo em andamento', null, null),
('Mayrla Almeida Silva', '100.843.314-45', 'Procon Municipal de João Pessoa', 'Sem retorno do cliente', 'RESPONDIDO E ARQUIVADO DEVIDO AUSENCIA DA RECLAMANTE NA AUDIENCIA', '2026-08-19 13:00:00-03', 'Mayrla - AUDIÊNCIA PROCON 19/08', null, null),
('Hildelucia de Lima Bertulino', '042.744.324-59', 'Procon Municipal de Campina Grande', 'Resolvido', 'RESPONDIDO E ARQUIVADO DEVIDO AUSENCIA DA RECLAMANTE NA AUDIENCIA', '2026-09-04 15:30:00-03', 'Hildelucia de Lima Bertulino  - Audiencia 04-09', null, null),
('Maria Suely Olinto do Ó', '270.684.698-41', 'Procon Municipal de João Pessoa', 'Resolvido', 'RESPONDIDO', '2026-07-20 00:00:00-03', 'MARIA SUELY - RESOLVIDO', null, null),
('Enir Josias Monteiro Carneiro de Sousa', '065.141.074-60', 'Procon Estadual da Paraíba', 'Resolvido', 'RESPONDIDO', null, 'ENIR - RESOLVIDO', null, null),
('Jeronimo Clementino Da Costa', '316.819.118-33', 'Procon Municipal de João Pessoa', 'Resolvido', 'RESPONDIDO', '2026-09-14 08:00:00-03', 'A) Jeronimo Clementino Da Costa - AUDIÊNCIA PROCON 25/08', null, null),
('Maria de Fatima Guimarães Vieira', '218.890.664-00', 'Procon Municipal de João Pessoa', 'Resolvido', 'RESPONDIDO', '2026-07-15 16:00:00-03', 'MARIA DE FÁTIMA - RESOLVIDO', null, null),
('Otilia Pedro da Silva', '036.923.558-40', 'Procon Estadual da Paraíba', 'Resolvido', 'RESPONDIDO', '2026-07-24 11:00:00-03', 'Otilia Maria - AUDIÊNCIA PROCON 24/07', null, null),
('Francisco de Assis Pereira', '374.020.214-91', 'Procon Estadual da Paraíba', 'Resolvido', 'RESPONDIDO', null, null, null, null),
('EGIONE DO NASCIMENTO ARAÚJO', '072.343.124-80', 'Procon Municipal de João Pessoa', 'Resolvido', 'RESPONDIDO', null, null, 'OSCAR', null),
('THAMYRES BRUNA MENEZES PATRICIO', '098.896.684-08', 'Procon Estadual da Paraíba', 'Resolvido', 'RESPONDIDO', null, null, null, null),
('Jarlene Souza Ribeiro', '051.433.134-81', 'Procon Estadual da Paraíba', 'Resolvido', 'RESPONDIDO', null, null, null, null),
('LUCIANE DIAS NUNES', '036.220.484-50', 'Procon Municipal de João Pessoa', 'Resolvido', 'RESPONDIDO', null, null, 'OSCAR', null),
('Maria Gilvanete Gonçalves', '674.695.074-34', 'Procon Municipal de João Pessoa', 'Resolvido', 'RESPONDIDO', '2026-09-23 14:00:00-03', 'Maria Gilvanete - AUDIÊNCIA PROCON 04/08', null, null),
('PRISCILA DE ANDRADE', '106.752.244-11', 'Procon Municipal de Campina Grande', 'Resolvido', 'RESPONDIDO', null, null, null, null),
('Inárleth Francisco Monteiro', '929.567.344-15', 'Procon Municipal de Campina Grande', 'Resolvido', 'RESPONDIDO', null, null, null, null),
('MIRIAM RAMOS BEZERRA DA SILVA', '052.519.094-54', 'Procon Municipal de João Pessoa', 'Não conseguimos contato com o cliente', 'RESPONDIDO', null, null, null, null),
('VANNUSKA GONÇALVES MAGALHÃES', '822.240.994-87', 'Procon Municipal de João Pessoa', 'Não conseguimos contato com o cliente', 'RESPONDIDO', null, null, null, null),
('Yan de Oliveira Sucupira', null, 'Judicial', 'Resolvido', 'CONDENAÇÃO DESFAVORÁVEL - AGUARDANDO GUIA DE PAGAMENTO', '2026-08-13 09:00:00-03', 'Yan - AUDIÊNCIA VARA CÍVEL - 13/08', null, null),
('JOSELY MARIA DA SILVA MAIA', null, 'Judicial', 'Resolvido', 'COMPROVANTE DE PAGAMENTO DA GUIA ENVIADA PARA O JURÍDICO', null, null, null, null),
('LUCIMEIRE ROMANELLI LINS', '014.532.527-03', 'Judicial', 'Resolvido', 'AUDIENCIA DESIGNADA', '2026-10-20 14:00:00-03', null, null, 'Dr. João aguardando Victor passar o restante das respostas'),
('KAMILLA RAQUEL PEREIRA SANTOS', '105.306.534-51', 'Procon Municipal de João Pessoa', 'Aguardando retorno do gerente', 'AUDIENCIA DESIGNADA', '2026-10-14 15:00:00-03', null, null, null),
('MARIA DE FATIMA SILVA DOS SANTOS', '090.955.014-00', 'Procon Estadual da Paraíba', 'Aguardando cliente ir à loja escolher novo produto', null, null, null, null, null),
('ANA GLAUCIA DE ANDRADE', '467.058.564-91', 'Procon Estadual da Paraíba', 'Aguardando retorno do fabricante', null, null, null, null, null),
('Manoela Cavalcante De Morais', '077.266.684-90', 'Reclame Aqui', 'Falta responder', null, null, null, null, null);
