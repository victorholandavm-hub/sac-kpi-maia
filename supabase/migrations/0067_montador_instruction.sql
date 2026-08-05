-- Campo separado do "Motivo" (que é do gerente da loja e continua escondido
-- do montador por conter possível detalhe sensível, ver migration da
-- remoção de reason da view do montador) -- só assistência/admin escreve
-- aqui, e o montador pode ver, sem risco de misturar com o que o gerente
-- escreveu.
alter table service_requests
  add column if not exists montador_instruction text;
