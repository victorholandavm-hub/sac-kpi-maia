import { ExpedicaoFila } from "@/components/logisticaOdoo/ExpedicaoFila";

// Fila de expedição do CD -- o conteúdo está em ExpedicaoFila (o SAC usa a
// mesma tela desde 29/10/2026).
export const dynamic = "force-dynamic";

export default async function ExpedicaoPage({ searchParams }: { searchParams: Promise<{ empresa?: string }> }) {
  return <ExpedicaoFila sp={await searchParams} />;
}
