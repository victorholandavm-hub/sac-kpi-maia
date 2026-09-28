import { getProfile } from "@/lib/dal";
import { PageHeader } from "@/components/assistencia/PageHeader";
import { ReclamacaoForm } from "@/components/assistencia/ReclamacaoForm";

export default async function NovaReclamacaoPage() {
  const profile = await getProfile();

  if (profile.role !== "admin") {
    return <p className="text-sm text-gray-400 dark:text-gray-500">Acesso restrito ao admin.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Nova reclamação" description="Procon, Reclame Aqui ou processo judicial" />
      <ReclamacaoForm />
    </div>
  );
}
