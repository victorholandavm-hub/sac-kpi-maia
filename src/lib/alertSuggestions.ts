// Sugestão de causa provável por tag de categoria (ver src/lib/labels.ts pro
// dicionário completo de tags) -- usado só pra dar um primeiro palpite no
// "Sinal" de StoreBreakdownTable, não é diagnóstico definitivo. Tags sem
// entrada aqui simplesmente não mostram sinal (ver ALERT_MIN_PCT/ALERT_MIN_TOTAL
// no componente pro corte de quando vale a pena mostrar).
export const ALERT_SUGGESTIONS: Record<string, string> = {
  "cat-duvida": "Falta de treinamento de produto na equipe de vendas",
  "cat-errovendedor": "Reforçar treinamento do vendedor",
  "cat-erroloja": "Revisar processo da loja na venda/entrega",
  "cat-erroconferencia": "Revisar conferência de pedido antes do envio",
  "cat-produtoerrado": "Revisar conferência de pedido antes do envio",
  "cat-entregaerrada": "Revisar cadastro de endereço/conferência de entrega",
  "cat-atraso": "Gargalo logístico -- revisar prazos de entrega",
  "cat-entregador": "Revisar rota/desempenho do entregador",
  "cat-errocd": "Revisar processo do centro de distribuição",
  "cat-avaria": "Revisar manuseio/transporte do produto",
  "cat-vendasemestoque": "Alinhar estoque disponível antes da venda",
  "cat-pecafaltante": "Revisar conferência de peças antes do envio",
};
