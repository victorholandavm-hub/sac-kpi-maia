import { redirect } from "next/navigation";
import { getTecnicoSession } from "@/app/assistencia/tecnico-actions";
import { TecnicoCabecalho } from "@/components/assistencia/TecnicoCabecalho";
import { TecnicoTabs } from "@/components/assistencia/TecnicoTabs";
import { ConsultaEstoqueView } from "@/components/ConsultaEstoqueView";

export const dynamic = "force-dynamic";

// Estoque dos produtos por loja/CD (Odoo) pra equipe técnica -- Victor
// 27/10/2026. Mesma consulta do SAC, sem o botão de transferir pro AT (a
// transferência é do SAC/assistência).
export default async function TecnicoEstoqueLojasPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const tecnicoName = await getTecnicoSession();
  if (!tecnicoName) redirect("/assistencia/tecnico/login");
  const { q } = await searchParams;
  return (
    <div className="w-full flex flex-col min-w-0 bg-[var(--background)] min-h-screen">
      <TecnicoCabecalho titulo="Estoque das lojas" subtitulo={`Olá, ${tecnicoName} — saldo de cada produto nas lojas e no CD, direto do Odoo.`} />
      <div className="max-w-6xl mx-auto w-full px-6 py-5 flex flex-col gap-5 min-w-0">
        <TecnicoTabs active="estoque-lojas" />
        <ConsultaEstoqueView busca={(q ?? "").trim()} acao="/assistencia/tecnico/estoque-lojas" podeTransferir={false} />
      </div>
    </div>
  );
}
