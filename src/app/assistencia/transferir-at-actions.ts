"use server";

import { revalidatePath } from "next/cache";
import { getOptionalProfile } from "@/lib/dal";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { saldoNoCd } from "@/lib/estoqueLojas";
import { mensagemDeErro } from "@/lib/odoo/logistica";
import { hojeRecife } from "@/lib/vouchersCore";

// Transferência de produto do CD pro estoque de peças da assistência (AT) --
// pedido do Victor 26/10/2026 ("o sac possa transferir um produto do estoque
// do CD para o estoque AT"; AT = nosso estoque de peças, /assistencia/estoque).
// Registra uma "retirada" por unidade, igual às que a assistência já lança à
// mão; a equipe técnica dá a baixa quando a saída for lançada no Odoo. Não
// escreve nada no Odoo: só confere o saldo do CD antes.

const MAX_UNIDADES = 10;

export type TransferirAtState = { error?: string; ok?: string } | undefined;

export async function transferirCdParaAt(_state: TransferirAtState, formData: FormData): Promise<TransferirAtState> {
  const profile = await getOptionalProfile();
  if (!profile || !["sac", "assistencia", "admin"].includes(profile.role)) {
    return { error: "Sessão expirada. Faça login de novo." };
  }

  const codigo = String(formData.get("codigo") ?? "").trim().toUpperCase();
  const cliente = String(formData.get("cliente") ?? "").trim();
  const pedido = String(formData.get("pedido") ?? "").trim();
  const obs = String(formData.get("obs") ?? "").trim();
  const quantidade = Number(formData.get("quantidade"));
  const fabricante = String(formData.get("fabricante") ?? "").trim();
  if (!codigo) return { error: "Produto sem código." };
  if (!cliente) return { error: "Informe o cliente atendido." };
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > MAX_UNIDADES) {
    return { error: `Quantidade entre 1 e ${MAX_UNIDADES}.` };
  }

  let saldo: Awaited<ReturnType<typeof saldoNoCd>>;
  try {
    saldo = await saldoNoCd(codigo);
  } catch (err) {
    return { error: `Não consegui conferir o saldo do CD no Odoo agora (${mensagemDeErro(err)}). Tente de novo em instantes.` };
  }
  if (!saldo) return { error: "CD não encontrado no Odoo." };
  if (saldo.disponivel < quantidade) {
    return { error: `O CD tem só ${Math.max(0, saldo.disponivel)} disponível agora.` };
  }

  const produto = String(formData.get("produto") ?? "").trim() || saldo.nome || codigo;
  const admin = getSupabaseAdmin();
  if (fabricante) {
    await admin.from("suppliers").upsert({ name: fabricante }, { onConflict: "name" });
  }
  const notas = [
    `Transferência CD → AT pelo ${profile.role === "sac" ? "SAC" : "painel"} (${profile.fullName}).`,
    pedido ? `PED: ${pedido}` : "",
    obs,
  ]
    .filter(Boolean)
    .join(" ");
  const hoje = hojeRecife();
  const linhas = Array.from({ length: quantidade }, (_, i) => ({
    movement_type: "retirado",
    code: codigo,
    product: produto,
    factory: fabricante || null,
    client_name: cliente,
    volume: quantidade > 1 ? `${i + 1}/${quantidade}` : null,
    responsible: profile.fullName,
    logged_date: hoje,
    notes: notas,
  }));
  const { error } = await admin.from("stock_movements").insert(linhas);
  if (error) return { error: `Não foi possível registrar: ${error.message}` };

  revalidatePath("/assistencia/estoque");
  return {
    ok: `${quantidade} ${quantidade === 1 ? "unidade registrada" : "unidades registradas"} no estoque AT, aguardando a baixa da equipe técnica.`,
  };
}
