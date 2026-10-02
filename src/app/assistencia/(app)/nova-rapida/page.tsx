import Link from "next/link";
import { getProfile, redirectIfSac } from "@/lib/dal";
import { listStores } from "@/lib/serviceRequests";
import { listAllAssemblersWithStoreId } from "@/lib/payments";
import { QuickCreateRequestForm } from "@/components/assistencia/QuickCreateRequestForm";

// Campos aceitos pra pré-preencher a partir de um cadastro (Controle
// Assistência -> Cadastros, "Criar nova visita" -- ver CadastroDetalheModal.tsx
// e useFormPrefill.ts). Mesmo nome dos campos do formulário, repassados
// direto sem transformação.
const PREFILL_FIELDS = ["type", "client_cpf", "client_name", "client_phone", "client_address", "reason"] as const;

export default async function NovaRapidaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const profile = await getProfile();
  redirectIfSac(profile);
  const [stores, assemblers, sp] = await Promise.all([listStores(), listAllAssemblersWithStoreId(), searchParams]);
  const initial: Record<string, string> = {};
  for (const field of PREFILL_FIELDS) {
    if (sp[field]) initial[field] = sp[field]!;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          Nova visita
        </h2>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          Montagem, desmontagem, troca de peça ou vistoria — cria já com o essencial preenchido. Depois dá pra
          completar os outros dados (CPF, bairro, observações…) na própria solicitação.
        </p>
        <Link href="/assistencia/nova-entrega" className="text-sm underline mt-1 inline-block" style={{ color: "var(--text-secondary)" }}>
          Precisa recolher uma peça? Vá pra Nova entrega →
        </Link>
      </div>
      <QuickCreateRequestForm stores={stores} assemblers={assemblers} includeSacTypes={profile.role === "admin"} initial={initial} />
    </div>
  );
}
