"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getProfile, requireRole } from "@/lib/dal";
import { isMovementType } from "@/lib/stockMovements";
import { getTecnicoSession } from "@/app/assistencia/tecnico-actions";

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const str = String(value ?? "").trim();
  return str.length > 0 ? str : null;
}

export type StockMovementFormState = { error?: string; success?: boolean } | undefined;

export async function createStockMovement(
  _state: StockMovementFormState,
  formData: FormData
): Promise<StockMovementFormState> {
  const profile = await getProfile();
  requireRole(profile, "assistencia", "admin");

  const movementType = String(formData.get("movement_type") ?? "");
  if (!isMovementType(movementType)) {
    return { error: "Tipo de movimentação inválido." };
  }

  const product = String(formData.get("product") ?? "").trim();
  if (!product) {
    return { error: "Informe o produto." };
  }

  // Código do produto e cliente atendido, obrigatórios -- pedido do
  // Victor 28/08/2026: "preciso apenas que o codigo do porduto e o
  // codigo do cliente sejam obrigatrios". Validação client-side
  // (`required` no form, ver NewStockMovementForm.tsx) já existia só
  // pra `product` -- replicando aqui pros outros dois, mesmo padrão de
  // sempre nesse projeto (nunca confiar só em validação client-side).
  const code = emptyToNull(formData.get("code"));
  if (!code) {
    return { error: "Informe o código do produto." };
  }
  const clientName = emptyToNull(formData.get("client_name"));
  if (!clientName) {
    return { error: "Informe o cliente atendido." };
  }

  const factoryChoice = String(formData.get("factory") ?? "").trim();
  const factoryOther = String(formData.get("factory_other") ?? "").trim();
  const factory = factoryChoice === "__outro__" ? factoryOther : factoryChoice;

  const admin = getSupabaseAdmin();
  if (factory) {
    await admin.from("suppliers").upsert({ name: factory }, { onConflict: "name" });
  }

  const { error } = await admin.from("stock_movements").insert({
    movement_type: movementType,
    code,
    product,
    factory: factory || null,
    client_name: clientName,
    volume: emptyToNull(formData.get("volume")),
    responsible: profile.fullName,
    movement_date: emptyToNull(formData.get("movement_date")),
    logged_date: emptyToNull(formData.get("logged_date")),
    notes: emptyToNull(formData.get("notes")),
  });

  if (error) {
    return { error: `Não foi possível registrar a movimentação: ${error.message}` };
  }

  revalidatePath("/assistencia/estoque");
  return { success: true };
}

// Baixa da retirada -- pedido do Victor 28/08/2026: "Assistencia
// registra e a equipe tecnica é que retira do estoque e lança a data
// que foi retirada". Sessão de EQUIPE TÉCNICA (tecnicoAuth.ts, cookie
// próprio -- não é o mesmo login de assistência/admin que cria o
// registro), não profiles/getProfile -- por isso importa
// getTecnicoSession de tecnico-actions.ts em vez de requireRole.
export async function withdrawStockMovement(movementId: string, withdrawnDate: string): Promise<void> {
  const tecnicoName = await getTecnicoSession();
  if (!tecnicoName) throw new Error("Sessão expirada. Faça login de novo.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(withdrawnDate)) throw new Error("Data inválida.");

  const admin = getSupabaseAdmin();
  const { data: movement, error: fetchError } = await admin
    .from("stock_movements")
    .select("id, movement_type, movement_date")
    .eq("id", movementId)
    .maybeSingle();
  if (fetchError || !movement) throw new Error("Movimentação não encontrada.");
  if (movement.movement_type !== "retirado") throw new Error("Só dá pra dar baixa em retirada.");
  if (movement.movement_date) throw new Error("Essa retirada já foi baixada.");

  const { error } = await admin
    .from("stock_movements")
    .update({ movement_date: withdrawnDate, withdrawn_by: tecnicoName })
    .eq("id", movementId);
  if (error) throw new Error(error.message);

  revalidatePath("/assistencia/tecnico/estoque");
  revalidatePath("/assistencia/estoque");
}
