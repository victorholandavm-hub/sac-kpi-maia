-- Estornos (reembolsos) do SAC/lojas -- pedido do Victor 22/09/2026: nova
-- aba "Estornos" em /clientes, referência num histórico curado à mão a
-- partir do grupo de WhatsApp "Lojas Maia e Líder Caixas" (planilha
-- estornos_lojas_maia_lider_caixas_1.xlsx, extraída em 07/09/2026,
-- cobrindo 27/07 a 06/09/2026 -- o WhatsApp Web só libera histórico a
-- partir da data em que o usuário entrou no grupo, não dá pra cobrir
-- período anterior). Sem sync automático -- não existe API de estorno
-- nenhuma pra puxar isso do Protheus/banco, é texto mesmo, registrado à
-- mão pelo time -- mesmo espírito de store_google_reviews (0092): tabela
-- + formulário na tela pra registrar as próximas leituras/casos, não um
-- job. Colunas espelham 1:1 as da planilha de referência (mesma ordem),
-- pra não perder nenhum dado na migração pro banco.
create table if not exists estornos (
  id uuid primary key default gen_random_uuid(),
  -- Data em que o pedido de estorno chegou (grupo do WhatsApp) -- não é a
  -- data da venda (data_venda abaixo), nem a data em que o estorno de
  -- fato aconteceu (isso não é rastreado à parte, só via texto livre em
  -- `status`).
  data_solicitacao date not null,
  cliente text not null,
  cpf_cnpj text,
  -- Código do cliente no Protheus ("105729") OU código de venda avulsa
  -- ("VF0605") -- os dois formatos aparecem na planilha de origem, sem
  -- distinção formal entre eles (texto livre, não normalizado).
  codigo_cliente text,
  valor_reembolso numeric(12,2) not null check (valor_reembolso >= 0),
  -- Nula quando a data da venda não pôde ser determinada na extração
  -- original (ex.: "/08/2026", faltando o dia) -- mais correto que
  -- chutar um dia.
  data_venda date,
  forma_pagamento text,
  motivo text,
  produto text,
  autorizado_por text,
  loja text not null,
  -- Texto livre (ex.: "Comprovante enviado", "Revertido", "Cliente
  -- cobrando estorno") -- não é um enum fechado, reflete só o que foi
  -- dito explicitamente na conversa (ou no cadastro manual daqui pra
  -- frente). Vazio/null = sem confirmação textual do desfecho ainda.
  status text,
  created_at timestamptz not null default now()
);

create index if not exists idx_estornos_data_solicitacao on estornos (data_solicitacao desc);
create index if not exists idx_estornos_loja on estornos (loja);
create index if not exists idx_estornos_cpf_cnpj on estornos (cpf_cnpj);

alter table estornos enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'estornos' and policyname = 'estornos_select_authenticated'
  ) then
    create policy estornos_select_authenticated on estornos for select to authenticated using (true);
  end if;
end $$;

-- Backfill histórico -- os 59 casos da planilha de referência
-- (estornos_lojas_maia_lider_caixas_1.xlsx), 27/07 a 06/09/2026. Ver nota
-- da planilha: algumas solicitações aparecem mais de uma vez (reenvio/
-- cobrança de comprovante no grupo, mesmo estorno) -- mantidas como
-- linhas separadas de propósito, preservando o histórico de cobrança tal
-- como estava na fonte, sem deduplicar.
insert into estornos
  (data_solicitacao, cliente, cpf_cnpj, codigo_cliente, valor_reembolso, data_venda, forma_pagamento, motivo, produto, autorizado_por, loja, status)
values
('2026-07-27', 'GERLANE PIMENTEL MELO', '052.654.024-97', '105729', 3000.0, '2026-06-29', 'DÉBITO', 'Fábrica entregou outra tonalidade, cliente desistiu', 'SOFA CONCEITO THANOS 2,50 VELUDO CINZA CHUMBO L000568', 'EMERSON', 'Lojas Maia', null),
('2026-07-27', 'JURANDIR JOSE DA SILVA', '760.672.034-72', '107603', 2377.6, '2026-07-08', 'CRÉDITO 10X', 'Falta de produto', null, 'Rafaela', 'Lojas Aiam', 'Cliente cobrando comprovante'),
('2026-07-27', 'VALDELUCIA OLIVEIRA DA SILVA', '027.940.964-86', '105086', 1600.0, '2026-06-25', 'PIX', 'Produto entregue errado, cliente não quis esperar troca', 'COZINHA SALVADOR COMPLETA', 'Fabiano', 'Maia - Campina Grande', null),
('2026-07-27', 'ALEXANDRO BENTO DA SILVA', '032.700.294-89', '109772', 2758.8, '2026-07-17', 'CRÉDITO 12X (+ frete R$50 Pix)', 'Prazo informado errado, cliente não quis esperar', 'SOFA ZEUS 070923', 'EMERSON', 'Lojas Maia', null),
('2026-07-27', 'ALEKISS MANÇO DE MELO', '104.465.314-05', '111532', 100.0, '2026-07-27', 'CRÉDITO 12X', 'Falta de produto, cliente não aceita esperar (parcial)', 'PROTETOR TRAVESSEIRO POLIESTER BEDS 50X70 (071025)', 'EMERSON', 'Lojas Maia', 'Sem devolução (n tem devolução)'),
('2026-07-28', 'WILSON VASCONCELOS DOS SANTOS', '884.955.668-34', '113054', 450.0, '2026-08-05', 'CRÉDITO 12X', 'Falta de produto FL (parcial)', 'FL ILHA 1200MM MDP BP NOG NOG CARRARO (L003381)', 'EMERSON', 'Lojas Maia', null),
('2026-07-29', 'JOSIAS ROCHA DA SILVA', '090.226.494-07', '109900', 2250.0, '2026-07-18', 'CRÉDITO 12X', 'Demora na entrega', 'SOFÁ ZEUS 2,30 BEGE', 'Fabiano', 'Maia - Campina Grande', null),
('2026-07-30', 'DIEGO DE FARIAS LIMA', '042.896.984-41', '107078', 700.0, '2026-07-20', 'CRÉDITO 2X', 'Demora na entrega', 'MULTIUSO ASTECA C/CHAVE CIN/OFF', 'Fabiano', 'Maia - Campina Grande', null),
('2026-07-30', 'THALITA CARDOSO DE ARAUJO RAMOS', '079.801.034-75', '108876', 1450.0, '2026-07-13', 'CRÉDITO', 'Cliente não irá esperar chegar produto', null, 'Oscar/Daniel', 'Líder Colchões', 'Cliente cobrando comprovante'),
('2026-07-31', 'BRENDON PEREIRA TRANQUILINO', '188.619.847-03', '107043', 1900.0, '2026-07-06', 'CRÉDITO 12X', 'Não foi entregue na data combinada', 'ROUP ANDREAS', 'LARYSSA', 'Lojas Aiam', null),
('2026-08-01', 'EDUARDO BARRETO CORDEIRO', '033.498.044-54', '113491', 999.9, '2026-08-07', 'PIX', 'Cliente não quis esperar prazo, não quis mostruário (R$949,90 + frete R$50)', 'ROUPEIRO PANAMA 2PTS L001741', 'EMERSON', 'Lojas Maia', 'Devolução feita'),
('2026-08-01', 'ALEKISS MANÇO DE MELO (2ª msg)', '104.465.314-05', '111532', 100.0, '2026-07-27', 'CRÉDITO 12X', 'Falta de produto, cliente não aceita esperar', 'PROTETOR TRAVESSEIRO POLIESTER BEDS 50X70 (071025)', 'EMERSON', 'Lojas Maia', null),
('2026-08-03', 'ANTONIO DE LISBOA VIEIRA', '407.824.417-34', '109241', 3550.0, '2026-07-15', 'PIX MÁQUINETA', 'Não foi entregue na data combinada, não chegou o produto', 'GALAXY PRIME 138 E BASE SUED MARFIM 138', 'Oscar', 'Líder Tambaú', 'Comprovante enviado'),
('2026-08-04', 'JOÃO FIGUEIREDO DA SILVA', '288.209.167-20', '106464', 900.0, '2026-07-03', 'PIX', 'Cliente não quis esperar', null, 'Oscar', 'Líder Colchões', null),
('2026-08-04', 'THALITA CARDOSO DE ARAUJO RAMOS', '079.801.034-75', '108876', 1450.0, '2026-07-13', 'CRÉDITO', 'Cliente não irá esperar chegar (encaminhada novamente)', null, 'Oscar', 'Líder Colchões', null),
('2026-08-04', 'NATHÁLIA REGINA GALVÃO', '109.374.654-88', 'VF0605', 500.0, '2026-08-02', 'CRÉDITO 4X', 'Produto não entregue no prazo desejado', 'COLCHÃO HORTÊNCIA D33 (010173)', 'EMERSON', 'Lojas Maia', null),
('2026-08-05', 'MARIA DI NATELMA SARAIVA PEREIRA', '475.036.104-68', '038712', 1800.0, '2026-07-25', 'CRÉDITO 12X', 'Produto não entregue no prazo desejado', 'MESA ITALIA 120 E CAD HELENA LINHO BEGE', 'LARYSSA', 'Lojas Aiam', 'Cliente cobrando estorno'),
('2026-08-06', 'MARIA DI NATELMA SARAIVA PEREIRA (frete)', '475.036.104-68', '038712', 50.0, '2026-07-25', 'PIX', 'Estorno do frete', '(mesma solicitação acima)', 'LARYSSA', 'Lojas Aiam', 'Comprovante enviado'),
('2026-08-06', 'RANIERE DA SILVA A. DE OLIVEIRA', '099.073.334-33', '112153', 1548.0, '2026-07-30', 'CRÉDITO 12X', 'Falta de produto', 'L003701-BELICHE EMA C/KIT PE-BRANCO CIMOL', 'Oscar', 'Lojas Maia Barão do Triunfo', null),
('2026-08-06', 'DEBORA CRISTINA DE ANDRADE BARBOSA', '720.396.894-43', '108988', 279.9, '2026-07-13', 'CRÉDITO 10X', 'Lançado como retirada por engano, cliente desistiu (parcial)', 'MULTIUSO 2PTS(071351)', 'EMERSON', 'Lojas Maia', null),
('2026-08-07', 'DANIELLE PONTES VERAS DO NASCIMENTO', '059.542.274-89', '025554', 1729.0, '2026-07-23', 'CRÉDITO 10X', 'Cliente desistiu do produto, passou do prazo (parcial)', 'ROUPEIRO FRANCIS FREIJO/OFF', 'LARYSSA', 'Lojas Aiam', null),
('2026-08-08', 'OTILIA PEDRO DA SILVA', '036.923.557-40', '064851', 3120.8, '2025-08-29', 'TRANSFERÊNCIA BANCÁRIA', 'Cliente de Procon (parcial)', '01 COLCHÃO MAYA FLOWERS 158X198X36 + 02 BOX 79X198X30 VOGA BEGE', 'Oscar Queiroz', 'Líder Colchões Select Manaíra', null),
('2026-08-08', 'JADIANA VIEIRA ALVES', '023.998.474-90', '100499', 400.0, '2026-06-01', 'CRÉDITO 12X', 'Fábrica alterou layout sem aviso, cliente não aceitou (parcial)', 'PAINEL TAINA P/TV 55 OFF WHITE/RIPADO TUBOARTE (071494)', 'EMERSON', 'Lojas Maia', null),
('2026-08-10', 'LUZINETE RODRIGUES DE FRANÇA SOARES', '109.071.494-72', '035968', 1670.0, '2026-07-15', 'CRÉDITO 12X', 'Falta de produto', '071252- ROUPEIRO 6P ANDREAS CIN/OFF', 'Rafaela', 'Lojas Aiam', null),
('2026-08-12', 'EDUARDO BARRETO CORDEIRO (repetida)', '033.498.044-54', '113491', 999.9, '2026-08-07', 'PIX', 'Cliente não quis esperar prazo', 'ROUPEIRO PANAMA 2PTS L001741', 'EMERSON', 'Lojas Maia', 'Comprovantes enviados'),
('2026-08-12', 'ALEKISS MANÇO DE MELO (3ª ref.)', '104.465.314-05', '111532', 100.0, '2026-07-27', 'CRÉDITO 12X', 'Falta de produto (parcial)', 'PROTETOR TRAVESSEIRO POLIESTER BEDS 50X70 (071025)', 'EMERSON', 'Lojas Maia', null),
('2026-08-12', 'WILSON VASCONCELOS DOS SANTOS (repetida)', '884.955.668-34', '113054', 450.0, '2026-08-05', 'CRÉDITO 12X', 'Falta de produto FL (parcial)', 'FL ILHA 1200MM MDP BP NOG NOG CARRARO (L003381)', 'EMERSON', 'Lojas Maia', null),
('2026-08-14', 'EDUARDO BARRETO CORDEIRO (nota fiscal)', '033.498.044-54', '113491', 999.9, '2026-08-07', 'PIX', 'Não quis esperar prazo, não quis mostruário', 'ROUPEIRO PANAMA 2PTS L001741', 'EMERSON', 'Lojas Maia', null),
('2026-08-14', 'MARCOS VINICIUS FERREIRA', '707.340.834-08', '113482', 608.0, '2026-08-07', 'PIX', 'Não tem o produto e não aceitou trocar', 'MULTI-USO ASTECA-L001723 E FL ROUPEIRO MAYA 3P-L002036', 'EMERSON', 'Lojas Maia', null),
('2026-08-14', 'SANDRO SECCHI', '184.357.418-77', '039078', 754.81, '2024-12-23', 'CRÉDITO 10X', 'Feito troca 3x e todas deram problema (parcial)', 'COLCHAO MALAGA MOLAS 24CMX1,98MX1,58M (L0...)', 'EMERSON', 'Lojas Maia', 'Cliente cobrando'),
('2026-08-14', 'DAVYSSON FERNANDES GOMES', '117.138.194-81', '113950', 500.0, '2026-08-09', 'CRÉDITO 10X', 'Produto reservado em CG mas repassado a outro cliente', 'ROUPEIRO', 'EMERSON', 'Lojas Maia', 'Cliente cobrando estorno'),
('2026-08-15', 'IARA MAYARA PEREIRA DOS SANTOS', '080.978.334-76', '098003', 450.0, '2026-08-07', 'PIX', 'Passou do prazo, cliente desistiu da compra', 'COMODA VALDEMOVEIS QUERO QUERO CIN/OFF-071246', 'EMERSON', 'Lojas Maia', 'Cliente cobrando'),
('2026-08-15', 'MANUEL DOMINGOS DA SILVA', '091.195.834-78', '109190', 300.0, '2026-08-11', 'ESPÉCIE', 'Cliente trocou o produto (parcial)', 'L001715-SOFÁ TOP 3L', 'Bruna', 'Lojas Maia Mamanguape', null),
('2026-08-17', 'SANDRA MARIA DOS SANTOS PEREIRA', '044.196.844-96', '108203', 1500.0, '2026-08-07', 'CRÉDITO 10X', 'Deram prazo baú para produto que está para chegar', 'ROUPEIRO BEIJA FLOR-108203', 'EMERSON', 'Lojas Maia', null),
('2026-08-18', 'DEYSE DE PINHO', '105.794.544-79', '110101', 1600.0, '2026-07-19', 'PIX', 'Produto FL, cliente não aceitou trocar por outro', 'ROUPEIRO ATHENAS-070382', 'EMERSON', 'Lojas Maia', null),
('2026-08-20', 'PRISCILA DE ANDRADE LIMA', '106.752.244-11', '113358', 80.0, '2026-08-07', 'PIX', 'Cliente veio fazer a retirada (frete)', 'FRETE', 'Fabiano', 'Maia - Campina Grande', null),
('2026-08-21', 'ELIANE SANTOS DE SOUZA BRITO', '043.330.404-93', '107875', 1700.0, '2026-07-09', 'CRÉDITO 6X', 'Pendência das cadeiras, não quis trocar nem esperar', 'L001874 / L001896', 'Fabiano', 'Maia - Campina Grande', 'Cliente questionando'),
('2026-08-22', 'GUSTAVO BALTHAZAR', '03345321599', 'VF0593', 1678.8, '2026-08-19', 'CRÉDITO 5X', 'Foi parcelado na quantidade errada', 'ROUPEIRO IPANEMA 071538', 'LARYSSA', 'Pluma Colchões', null),
('2026-08-24', 'SANDRO SECCHI (repetida)', '184.357.418-77', '039078', 754.81, '2024-12-23', 'CRÉDITO 10X', 'Feito troca 3x, todas deram problema (parcial)', 'COLCHAO MALAGA MOLAS 24CMX1,98MX1,58M', 'EMERSON', 'Lojas Maia', null),
('2026-08-24', 'DAVYSSON FERNANDES GOMES (repetida)', '117.138.194-81', '113950', 500.0, '2026-08-09', 'CRÉDITO 10X', 'Produto reservado repassado a outro cliente', 'ROUPEIRO', 'EMERSON', 'Lojas Maia', 'Cliente cobrando'),
('2026-08-25', 'MARIA DE FATIMA ALVES PEREIRA', '602.233.164-15', '114530', 2870.0, '2026-08-12', 'CRÉDITO 12X', 'Demora na entrega do produto', 'ROUPEIRO HOPPER 2.7 071257', 'Fabiano', 'Maia - Campina Grande', null),
('2026-08-26', 'MARIA VERONICA CRUZ DE FREITAS', '826.493.244-49', '094458', 200.0, '2026-08-13', 'ESPÉCIE', 'Cliente desistiu da compra (estorno parcial)', '071194-MESA DE CENTRO PÉROLA', 'Bruna', 'Lojas Maia Mamanguape', null),
('2026-08-27', 'FLÁVIO JOSÉ RODRIGUES DA MOTA', '083.085.174-71', '102650', 80.0, '2026-06-12', 'CRÉDITO 12X', 'Cliente veio retirar, estorno apenas do frete', null, 'Fabiano', 'Maia - Campina Grande', 'Cliente questionando desde 12/06'),
('2026-08-28', 'SANDRA MARIA DOS SANTOS PEREIRA (repetida)', '044.196.844-96', '108203', 1500.0, '2026-08-07', 'CRÉDITO 10X', 'Deram prazo baú para produto que está para chegar', 'ROUPEIRO BEIJA FLOR-108203', 'EMERSON', 'Lojas Maia', 'Comprovante enviado'),
('2026-08-29', 'REBECA ROCHA D DE PAULA', '064.760.341-11', '116732', 850.0, '2026-08-22', 'DÉBITO MASTERCARD', 'Produto não entregue na data combinada, cliente não aceita mais receber', 'PANELEIRO 4P BURGUES', 'EMERSON', 'Lojas Maia', 'Cliente cobrando estorno'),
('2026-08-29', 'GUSTAVO BALTHAZAR (repetida)', '03345321599', 'VF0593', 1678.8, '2026-08-19', 'CRÉDITO 5X', 'Foi parcelado na quantidade errada', 'ROUPEIRO IPANEMA 071538', 'LARYSSA', 'Pluma Colchões', null),
('2026-08-29', 'DAVYSSON FERNANDES GOMES (3ª ref.)', '117.138.194-81', '113950', 500.0, '2026-08-09', 'CRÉDITO 10X', 'Produto reservado repassado a outro cliente', 'ROUPEIRO', 'EMERSON', 'Lojas Maia', null),
('2026-08-29', 'ELANY JOSEFA SANTOS OLIVEIRA', '106.518.134-50', '115894', 2000.0, '2026-08-19', 'CRÉDITO 10X', 'Cliente informou que vai se mudar e desistiu da compra', 'ROUPEIRO FRANCIS 1,8/071255', 'Oscar', 'Líder Colchões', null),
('2026-08-29', 'ENDI NOBREGA CAVALCANTE DE MEDEIROS', '111.791.264-75', '117853', 150.0, '2026-08-29', 'CRÉDITO 12X', 'Produto foi vendido errado', 'FL AEREO GELADEIRA PEROLA SALLETO-BCO L003041', 'Oscar', 'Líder Colchões', 'Revertido'),
('2026-08-31', 'FLAYRLTON SILVA CARNEIRO', '010.731.485-13', '115666', 2200.0, '2026-08-17', 'CRÉDITO 12X (+ frete R$50 Pix)', 'Produto entregue com avarias', 'COZINHA JÉSSICA-L003578', 'EMERSON', 'Lojas Maia', null),
('2026-09-01', 'SANIELY DA SILVA SANTOS', '016.295.974-57', '116502', 925.0, null, 'PIX', 'Demora na entrega do produto, prazo estendido', 'ROUPEIRO RECIFE-L001708', 'Fabiano', 'Maia - Campina Grande', 'Cliente insistindo'),
('2026-09-01', 'VERINICA CANDIDO', '142.646.554-80', '114163', 1200.0, '2026-08-10', 'CRÉDITO 12X MASTERCARD', 'Produto em falta, previsão estendida para 25/09', 'PANAMA 2PTS-L001741', 'EMERSON', 'Lojas Maia', null),
('2026-09-01', 'GEOVANE DOMINGOS DOS SANTOS', '074.771.724-97', '115564', 2115.0, '2026-08-17', 'PIX (parcial R$2.115 de R$2.200)', 'Produto faltando', '071236 COLCHÃO RENNES 1,88X1,38 + BAÚ VOGA MARROM 88X188X35', 'Oscar', 'Lojas Aiam', 'Estorno parcial realizado'),
('2026-09-02', 'ABADIAS MARIA VIEIRA', '609.811.641-53', '118823', 50.0, '2026-09-02', 'DÉBITO', 'Recebeu vale pós-compra, pediu estorno do frete (parcial)', null, 'EMERSON', 'Lojas Maia', null),
('2026-09-03', 'PATRICIA VIEIRA DA SILVA', '029.337.844-40', '117043', 250.0, '2026-08-29', 'PIX', 'Protetor avariado, cliente não aceitou outro', 'PROTETOR (avariado)', 'LARYSSA', 'Aiam Móveis Mangabeira', null),
('2026-09-05', 'CINELANDIA LISBOA CADAXO', '031.099.244-39', '113556', 1678.8, '2026-08-08', 'CARTÃO DE CRÉDITO', 'Cliente não recebeu o pedido no prazo, optou pelo estorno', 'SOFA CELTA VELUDO DELUXE MARROM KAPPESBERG', 'Bruna', 'Lojas Maia Mamanguape', null),
('2026-09-05', 'MARIA EDUARDA GURGEL LEITE', '715.231.944-80', '118616', 1198.8, '2026-09-01', 'CRÉDITO 12X VIA LINK', 'Cliente comprou online e desistiu da compra', null, 'LARYSSA', 'Líder Colchões', null),
('2026-09-06', 'VANDA CELIA BEZERRA DO SANTOS', '080.415.754-55', '023315', 718.8, '2026-08-31', 'CRÉDITO 7X MASTER', 'Falta de produto', 'L003108-ARMARIO AEREO 1P BASCULA ADEGA NESHER BARONESA/IMPERATRIZ 120CM-FREIJO', 'Oscar', 'Lojas Maia Barão do Triunfo', null),
('2026-09-06', 'PAULA ADRIANA GOMES MARINHO', '726.303.884-68', '118699', 1538.8, '2026-09-01', 'VISA 12X (+ frete R$80)', 'Produto lançado errado e mau atendimento do entregador, cliente desistiu', 'BOX 138X188', null, '+55 83 9112-9046 (Líder Colchões)', 'Comprovante em PDF enviado (carta de cancelamento)');
