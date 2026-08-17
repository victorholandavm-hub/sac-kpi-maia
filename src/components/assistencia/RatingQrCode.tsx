import { headers } from "next/headers";
import QRCode from "qrcode";

// Server component de propósito -- gera o QR já como data URL no servidor
// (biblioteca "qrcode" não depende de canvas nativo pra isso, só pngjs puro
// em JS), sem precisar de bundle/estado no cliente pra um <img> estático.
// Host vem do header (não de env fixa) porque o mesmo código roda em 4
// domínios/paths diferentes (sac, sac-ip, assistencia, assistencia-ip -- ver
// lojas_maia_deploy nas memórias e o comentário de basePath em next.config.ts).
export async function RatingQrCode({ requestId }: { requestId: string }) {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const basePath = process.env.NEXT_BASE_PATH ?? "";
  const url = `${proto}://${host}${basePath}/assistencia/avaliar/${requestId}`;
  const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 240 });

  return (
    <div
      className="flex flex-col items-center gap-3 rounded-lg p-4 text-center"
      style={{ border: "2px solid var(--status-good)", background: "color-mix(in srgb, var(--status-good) 8%, var(--surface-1))" }}
    >
      <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
        📱 Peça pro cliente escanear com o celular <u>dele</u> pra avaliar
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element -- data URL gerada no servidor, sem otimizador de imagem do Next envolvido */}
      <img src={qrDataUrl} alt="QR code para avaliação do atendimento" width={220} height={220} />
      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
        A avaliação só é liberada depois que o cliente confirma o CPF do pedido.
      </p>
    </div>
  );
}
