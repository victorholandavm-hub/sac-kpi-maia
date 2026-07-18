-- Zera o contador de número de chamado depois da limpeza dos dados históricos
-- importados das planilhas (service_requests, part_orders e afins) — o
-- próximo chamado criado na plataforma será o #4500.

select setval('chamado_number_seq', 4499, true);
