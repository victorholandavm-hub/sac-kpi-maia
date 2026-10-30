"use server";

import { getProfile, requireRole } from "@/lib/dal";
import { consultarPedidosOdoo } from "@/lib/consultaOdooPonte";
import { mensagemDeErro } from "@/lib/odoo/logistica";

// Nota automática na notificação de assistência (Victor 30/10/2026): acha os
// pedidos do cliente (CPF/CNPJ, pedido ou nome) com as notas que têm chave --
// do Odoo e as antigas do Protheus das vendas migradas. Nota de entrega primeiro.
export type NotaDoPedido = { tipo: "entrega" | "venda" | "outra"; rotulo: string; numero: string; chave: string };
export type PedidoComNotas = { pedido: string; loja: string; data: string; total: number; notas: NotaDoPedido[] };

export async function buscarNotasDoClienteAction(q: string): Promise<{ ok: true; pedidos: PedidoComNotas[] } | { ok: false; erro: string }> {
  const profile = await getProfile();
  requireRole(profile, "admin", "sac", "assistencia");
  const busca = q.trim();
  if (busca.replace(/\D/g, "").length < 3 && busca.length < 3) return { ok: false, erro: "Digite o CPF, o pedido ou o nome." };
  try {
    const pedidos = await consultarPedidosOdoo(busca);
    return {
      ok: true,
      pedidos: pedidos
        .map((p) => {
          const notas: NotaDoPedido[] = [];
          const add = (tipo: string, numero: string, chave: string | undefined, protheus: boolean) => {
            if (!chave || notas.some((n) => n.chave === chave)) return;
            const t = tipo.startsWith("5117") ? "entrega" : tipo.startsWith("5922") ? "venda" : "outra";
            notas.push({ tipo: t, rotulo: `${t === "entrega" ? "Nota de entrega" : t === "venda" ? "Nota de venda" : `Nota ${tipo}`} ${numero}${protheus ? " (Protheus)" : ""}`, numero, chave });
          };
          add("5117", p.legado?.nf_5117 ?? "", p.legado?.chave_5117, true);
          for (const n of p.notas ?? []) add(n.tipo, n.numero, n.chave, false);
          add("5922", p.legado?.nf_5922 ?? "", p.legado?.chave_5922, true);
          notas.sort((a, b) => (a.tipo === "entrega" ? 0 : a.tipo === "venda" ? 1 : 2) - (b.tipo === "entrega" ? 0 : b.tipo === "venda" ? 1 : 2));
          return { pedido: p.pedido, loja: p.loja ?? "", data: (p.data ?? "").slice(0, 10), total: Number(p.total ?? 0), notas };
        })
        .filter((p) => p.notas.length)
        .slice(0, 15),
    };
  } catch (err) {
    return { ok: false, erro: mensagemDeErro(err) };
  }
}
