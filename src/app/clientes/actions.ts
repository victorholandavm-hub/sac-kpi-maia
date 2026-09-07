"use server";

import { revalidatePath } from "next/cache";
import { requireDashboardAuth } from "@/lib/dashboardSession";
import { listComprasDoCliente, setCanalAquisicao, isCanalAquisicao, type ClienteCompra } from "@/lib/clientes";
import { registrarContato, registrarResultadoContato, marcarNaoContatar, desmarcarNaoContatar, type RecompraResultado } from "@/lib/recompra";

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

// Fase 2 do Motor de Recompra -- pedido do Victor 07/09/2026: registrar
// quando alguém do time contatou um candidato da aba "Propensão a
// recompra" e, depois, se virou venda -- fecha o elo de feedback que o
// desenho original apontou como a peça que falta (ver
// motor-de-recompra.html). revalidatePath pra a lista já vir com o
// estado novo na próxima navegação, sem precisar de refresh manual.
export async function registrarContatoAction(clientId: string, segmento: string, contatadoPor: string): Promise<void> {
  await requireDashboardAuth();
  await registrarContato(clientId, segmento, contatadoPor);
  revalidatePath("/clientes");
}

export async function registrarResultadoContatoAction(contatoId: string, resultado: RecompraResultado): Promise<void> {
  await requireDashboardAuth();
  await registrarResultadoContato(contatoId, resultado);
  revalidatePath("/clientes");
}

// Salvaguarda de LGPD -- pedido do Victor 07/09/2026 (ver migration
// 0109_recompra_nao_contatar.sql): opt-out do contato comercial
// proativo da aba "Propensão a recompra". "Quem marcou" é texto livre --
// mesmo motivo de contatadoPor em registrarContatoAction (login do
// painel de KPIs é senha única compartilhada do time).
export async function marcarNaoContatarAction(clientId: string, motivo: string, criadoPor: string): Promise<void> {
  await requireDashboardAuth();
  await marcarNaoContatar(clientId, motivo, criadoPor);
  revalidatePath("/clientes");
}

export async function desmarcarNaoContatarAction(clientId: string): Promise<void> {
  await requireDashboardAuth();
  await desmarcarNaoContatar(clientId);
  revalidatePath("/clientes");
}

// Canal de aquisição -- pedido do Victor 07/09/2026: "como esse cliente
// chegou até a loja", preenchido manualmente aos poucos (ver
// CanalAquisicaoSelect.tsx, aba Status). Sem "definido por" individual
// (mesmo motivo de sempre -- login do painel é senha única do time).
export async function setCanalAquisicaoAction(clientId: string, canal: string): Promise<void> {
  await requireDashboardAuth();
  if (!isCanalAquisicao(canal)) throw new Error("Canal inválido.");
  await setCanalAquisicao(clientId, canal, "");
  revalidatePath("/clientes");
}
