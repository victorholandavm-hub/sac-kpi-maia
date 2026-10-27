"use server";

import { revalidatePath } from "next/cache";
import { getTecnicoSession } from "@/app/assistencia/tecnico-actions";
import { mensagemDeErro, transferirEstoques } from "@/lib/odoo/logistica";

// Transferência estoque de venda <-> estoque AT (Assistência) pela equipe
// técnica -- Victor 27/10/2026. Mesma rota do Pedro do SAC e da Logística
// (/inventario/transferir): só sai saldo livre e, se faltar, nada é movido;
// quem fez e o motivo ficam no histórico do Odoo.

export type TransferenciaAtState = { ok?: string; erro?: string } | undefined;

export async function transferirEstoqueAt(_state: TransferenciaAtState, formData: FormData): Promise<TransferenciaAtState> {
  const tecnico = await getTecnicoSession();
  if (!tecnico) return { erro: "Sessão expirada. Entre de novo." };

  const empresa = Number(formData.get("empresa"));
  const codigo = String(formData.get("codigo") ?? "").trim().toUpperCase();
  const qtd = Number(formData.get("qtd"));
  const direcao = String(formData.get("direcao") ?? "");
  const motivo = String(formData.get("motivo") ?? "").trim();
  if (!Number.isInteger(empresa) || empresa <= 0) return { erro: "Escolha a loja ou o CD." };
  if (!codigo) return { erro: "Informe o código do produto." };
  if (!Number.isFinite(qtd) || qtd <= 0) return { erro: "Quantidade inválida." };
  if (direcao !== "para_at" && direcao !== "do_at") return { erro: "Escolha a direção." };
  if (!motivo) return { erro: "Informe o motivo." };

  const [origem, destino] = direcao === "para_at" ? (["estoque", "assistencia"] as const) : (["assistencia", "estoque"] as const);
  try {
    const r = await transferirEstoques({ company_id: empresa, origem, destino, itens: [{ codigo, qtd }], motivo }, `Técnica ${tecnico}`);
    if (!r.ok) return { erro: r.msg || "O Odoo recusou a transferência." };
    revalidatePath("/assistencia/tecnico/estoque-at");
    return { ok: `${qtd} × ${codigo}: ${r.de} → ${r.para} (${r.picking}).` };
  } catch (err) {
    return { erro: mensagemDeErro(err) };
  }
}
