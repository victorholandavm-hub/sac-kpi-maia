-- Operador de fábrica com acesso a todas as fábricas próprias (caso do
-- Rafael, que já cobre todo fornecedor externo via CD e agora também
-- precisa mexer nos pedidos das duas fábricas próprias, não só uma). NULL
-- em fabrica_id passa a significar "todas" -- ver EncomendaActor.fabricaId
-- em src/lib/encomendaAuth.ts e requireEncomendaAction em src/lib/dal.ts,
-- que já tratam fabricaId nulo como "sem restrição de fábrica".

alter table fabrica_operadores alter column fabrica_id drop not null;
