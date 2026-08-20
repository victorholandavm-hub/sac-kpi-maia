"use server";

import { requireDashboardAuth } from "@/lib/dashboardSession";
import { listComprasDoCliente, type ClienteCompra } from "@/lib/clientes";

// Busca sob demanda, só quando o nome é clicado -- pedido do Victor
// 20/08/2026: "não quero que ao clicar vá para outra tela, tem que expandir
// logo abaixo" (ver ClienteHistoricoRow.tsx). Trazer o histórico de todo
// mundo de uma vez junto com a lista (50 clientes/página) seria
// desperdício -- a esmagadora maioria nunca chega a ser expandida.
export async function getComprasDoClienteAction(
  clientId: string
): Promise<{ nome: string | null; cpfCnpj: string | null; compras: ClienteCompra[] }> {
  await requireDashboardAuth();
  return listComprasDoCliente(clientId);
}
