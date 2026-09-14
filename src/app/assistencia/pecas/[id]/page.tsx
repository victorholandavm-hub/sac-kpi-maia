import { PartOrderDetailContent } from "@/components/assistencia/PartOrderDetailContent";

// Acesso (Profile assistência/admin) já garantido pelo layout
// (pecas/layout.tsx, ver pecasAccess.ts) -- nada a checar aqui. Conteúdo
// vive em PartOrderDetailContent.tsx, reaproveitado pela rota própria da
// equipe técnica (/assistencia/tecnico/pecas/[id]) desde 14/09/2026.
export default async function PartOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PartOrderDetailContent id={id} basePath="/assistencia/pecas" />;
}
