import { notFound } from "next/navigation";
import { getProfile } from "@/lib/dal";
import { getReclamacaoById } from "@/lib/reclamacoes";
import { PageHeader } from "@/components/assistencia/PageHeader";
import { ReclamacaoForm } from "@/components/assistencia/ReclamacaoForm";

export default async function EditarReclamacaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getProfile();

  if (profile.role !== "admin") {
    return <p className="text-sm text-gray-400 dark:text-gray-500">Acesso restrito ao admin.</p>;
  }

  const reclamacao = await getReclamacaoById(id);
  if (!reclamacao) notFound();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={reclamacao.nome} description="Editar reclamação" />
      <ReclamacaoForm reclamacao={reclamacao} />
    </div>
  );
}
