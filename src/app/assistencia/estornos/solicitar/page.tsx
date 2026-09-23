import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveEstornoRequester } from "@/lib/estornoRequester";
import { NovoEstornoRequestForm } from "@/components/assistencia/NovoEstornoRequestForm";
import { AssistenciaHeader } from "@/components/assistencia/AssistenciaHeader";

export const dynamic = "force-dynamic";

export default async function SolicitarEstornoPage() {
  const requester = await resolveEstornoRequester();
  if (!requester) {
    redirect("/assistencia/estornos");
  }

  let storeOptions: { id: string; name: string }[] | undefined;
  if (requester.kind === "gerente" && requester.storeIds.length > 1) {
    const admin = getSupabaseAdmin();
    const { data } = await admin.from("stores").select("id, name").in("id", requester.storeIds).order("name");
    storeOptions = data ?? [];
  }

  return (
    <div className="max-w-xl mx-auto p-6 flex flex-col gap-6 w-full min-w-0">
      <AssistenciaHeader title="Solicitar estorno" subtitle="Preencha os dados e anexe o comprovante da venda." />
      <NovoEstornoRequestForm storeOptions={storeOptions} />
      <Link href="/assistencia/estornos" className="text-sm underline self-center" style={{ color: "var(--text-secondary)" }}>
        ← Voltar
      </Link>
    </div>
  );
}
