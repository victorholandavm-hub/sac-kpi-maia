import { NextResponse } from "next/server";
import { readPhotoFile } from "@/lib/localPhotoStorage";

// Mesma allowlist de extensões de servicePhotos.ts -- se um dia divergirem,
// o pior caso aqui é servir com Content-Type genérico (application/octet-stream),
// não um problema de segurança (o arquivo em si já passou pela checagem de
// magic bytes no upload).
const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
};

export const dynamic = "force-dynamic";

// Sem checagem de sessão de propósito -- mesmo nível de proteção que a URL
// assinada de antes (Supabase Storage): quem tem o caminho exato (que inclui
// um UUID de 128 bits, não adivinhável) consegue ver a foto, ninguém mais.
// Igual antes, então não é uma regressão de segurança -- só não é MELHOR
// nesse aspecto. Foto de comprovante/produto não é dado sensível o bastante
// pra justificar exigir sessão de todos os públicos que precisam ver (staff,
// motorista, montador, loja), o que ia exigir aceitar cookie de 4 sistemas
// de login diferentes aqui.
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  if (!segments || segments.length === 0) {
    return new NextResponse(null, { status: 404 });
  }

  const relativePath = segments.join("/");
  const buffer = await readPhotoFile(relativePath);
  if (!buffer) {
    return new NextResponse(null, { status: 404 });
  }

  const ext = relativePath.split(".").pop()?.toLowerCase() ?? "";
  const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentType,
      // Nome do arquivo é um UUID único que nunca muda de conteúdo -- pode
      // cachear pra sempre sem risco de servir versão velha.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
