import Image from "next/image";
import { ClientRatingForm } from "@/components/assistencia/ClientRatingForm";

export const dynamic = "force-dynamic";

// Rota pública (sem login de montador/motorista/gerente) -- o link só sai
// pelo QR code exibido na tela de conclusão do prestador (ver
// RatingQrCode.tsx). Confirmação de identidade (CPF) e todas as regras de
// quando liberar a nota ficam em avaliar/actions.ts, não aqui.
export default async function AvaliarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-sm w-full flex flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Image src="/logo.png" alt="Lojas Maia" width={225} height={225} className="h-16 w-16 object-contain" />
          <h1 className="text-xl font-semibold" style={{ color: "var(--brand-green)" }}>
            Avalie o atendimento
          </h1>
        </div>
        <ClientRatingForm requestId={id} />
      </div>
    </div>
  );
}
