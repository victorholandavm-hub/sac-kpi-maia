import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// 26/10 (Victor: "quem conferiu" nos eventos da carga): grava quem fez cada passo (tabela odoo_carga_acoes, 0206).
// 29/10: também a saída da retirada no CD / "Nota de entrega" do SAC e a do motorista -- todo "sair" emite as 5117
// e o John precisa ver quem faturou (notasDeOutros.ts).
// Nunca derruba a ação: o Odoo já aceitou; se o banco falhar, só fica no log.
export async function registrarAcaoCarga(cargaId: number, romaneio: string | null, acao: string, estado: string | null, operador: string) {
  try {
    const { error } = await getSupabaseAdmin().from("odoo_carga_acoes").insert({ carga_id: cargaId, romaneio, acao, estado, operador });
    if (error) console.error("[logistica-odoo] registrar ação da carga", cargaId, acao, error.message);
  } catch (err) {
    console.error("[logistica-odoo] registrar ação da carga", cargaId, acao, err);
  }
}
