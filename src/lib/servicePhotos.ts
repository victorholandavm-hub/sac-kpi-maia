import { randomUUID } from "crypto";
import { getSupabaseAdmin } from "./supabaseAdmin";

const BUCKET = "service-request-photos";
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hora — tempo suficiente pra abrir a página e ver as fotos
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// Allowlist explícita de formatos de foto real — nunca SVG (pode conter script
// embutido e roda quando alguém abre a URL assinada direto no navegador).
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
};

// Confere os bytes reais do arquivo, não só o Content-Type que o navegador
// mandou (esse é só uma sugestão do cliente, fácil de forjar num POST
// direto) -- defesa em profundidade contra um arquivo com conteúdo
// arbitrário rotulado como um tipo permitido.
function matchesMagicBytes(mimeType: string, buffer: Buffer): boolean {
  switch (mimeType) {
    case "image/jpeg":
      return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case "image/png":
      return (
        buffer.length >= 8 &&
        buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      );
    case "image/webp":
      return (
        buffer.length >= 12 &&
        buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
        buffer.subarray(8, 12).toString("ascii") === "WEBP"
      );
    case "image/heic":
    case "image/heif":
      // Contêiner ISOBMFF: box "ftyp" começa no offset 4, independente da marca.
      return buffer.length >= 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp";
    case "application/pdf":
      return buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-";
    default:
      return false;
  }
}

export type RequestPhoto = {
  id: string;
  url: string;
  isPdf: boolean;
  uploadedBy: string | null;
  caption: string | null;
  createdAt: string;
  // Comprovante de entrega assinado (motorista) -- distingue da foto comum
  // (observação, avaria etc.). Ver driverCompleteRequest (driver-actions.ts),
  // que exige pelo menos uma com isProof antes de concluir.
  isProof: boolean;
};

export async function listRequestPhotos(requestId: string): Promise<RequestPhoto[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("service_request_photos")
    .select("id, storage_path, uploaded_by, caption, created_at, is_proof")
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  return Promise.all(
    rows.map(async (row) => {
      const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS);
      return {
        id: row.id as string,
        url: signed?.signedUrl ?? "",
        isPdf: (row.storage_path as string).toLowerCase().endsWith(".pdf"),
        uploadedBy: row.uploaded_by as string | null,
        caption: row.caption as string | null,
        createdAt: row.created_at as string,
        isProof: !!row.is_proof,
      };
    })
  );
}

// Usado só por driverCompleteRequest pra checar a exigência sem precisar
// gerar URL assinada pra toda foto do chamado (listRequestPhotos faz uma
// chamada de storage por foto -- desnecessário só pra saber se existe 1).
export async function hasProofPhoto(requestId: string): Promise<boolean> {
  const admin = getSupabaseAdmin();
  const { count, error } = await admin
    .from("service_request_photos")
    .select("id", { count: "exact", head: true })
    .eq("request_id", requestId)
    .eq("is_proof", true);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

async function uploadPhotoBytes(requestId: string, file: File): Promise<string> {
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    throw new Error("Formato não suportado. Envie uma foto (JPEG, PNG, WEBP ou HEIC) ou um PDF.");
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error("A foto é grande demais (máximo 10 MB).");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!matchesMagicBytes(file.type, buffer)) {
    throw new Error("O conteúdo do arquivo não bate com o formato declarado. Envie uma foto ou PDF de verdade.");
  }

  const admin = getSupabaseAdmin();
  const path = `${requestId}/${randomUUID()}.${ext}`;

  const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, buffer, {
    contentType: file.type,
  });
  if (uploadError) {
    console.error("uploadPhotoBytes upload failed:", uploadError.message);
    throw new Error("Não foi possível enviar a foto agora. Tente de novo em instantes.");
  }
  return path;
}

async function insertPhotoMetadata(opts: {
  requestId: string;
  path: string;
  uploadedBy: string | null;
  caption?: string | null;
  isProof?: boolean;
}): Promise<void> {
  const admin = getSupabaseAdmin();
  const caption = opts.caption?.trim() || null;
  const { error: insertError } = await admin.from("service_request_photos").insert({
    request_id: opts.requestId,
    storage_path: opts.path,
    uploaded_by: opts.uploadedBy,
    caption,
    is_proof: !!opts.isProof,
  });
  if (insertError) {
    console.error("insertPhotoMetadata failed:", insertError.message);
    await admin.storage.from(BUCKET).remove([opts.path]);
    throw new Error("Não foi possível salvar a foto agora. Tente de novo em instantes.");
  }
}

export async function saveRequestPhoto(opts: {
  requestId: string;
  file: File;
  uploadedBy: string | null;
  caption?: string | null;
  isProof?: boolean;
}): Promise<void> {
  const path = await uploadPhotoBytes(opts.requestId, opts.file);
  await insertPhotoMetadata({ requestId: opts.requestId, path, uploadedBy: opts.uploadedBy, caption: opts.caption, isProof: opts.isProof });
}

// Pra fluxos onde o anexo é obrigatório (ex.: createSacRequest) e o ticket
// só deve existir se o anexo existir: sobe o arquivo ANTES de criar a linha
// em service_requests (o path não depende da linha existir, só do id, que o
// chamador gera antecipadamente). Se o upload falhar, nenhum ticket chega a
// ser criado. attachPendingRequestPhoto grava o metadado depois que o
// ticket existe de fato (FK exige a linha pai); se isso falhar, o chamador
// deve desfazer o ticket para não deixar um chamado "válido" sem anexo.
export async function uploadPendingRequestPhoto(requestId: string, file: File): Promise<string> {
  return uploadPhotoBytes(requestId, file);
}

export async function attachPendingRequestPhoto(opts: {
  requestId: string;
  path: string;
  uploadedBy: string | null;
  caption?: string | null;
}): Promise<void> {
  return insertPhotoMetadata(opts);
}

export async function discardPendingRequestPhoto(path: string): Promise<void> {
  const admin = getSupabaseAdmin();
  await admin.storage.from(BUCKET).remove([path]);
}

export async function getPhotoForAuth(
  photoId: string
): Promise<{ requestId: string; uploadedBy: string | null; storagePath: string } | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("service_request_photos")
    .select("request_id, uploaded_by, storage_path")
    .eq("id", photoId)
    .maybeSingle();
  if (error || !data) return null;
  return { requestId: data.request_id as string, uploadedBy: data.uploaded_by as string | null, storagePath: data.storage_path as string };
}

export async function deleteRequestPhoto(photoId: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from("service_request_photos").select("storage_path").eq("id", photoId).maybeSingle();
  if (error || !data) throw new Error("Foto não encontrada.");

  await admin.storage.from(BUCKET).remove([data.storage_path as string]);

  const { error: delError } = await admin.from("service_request_photos").delete().eq("id", photoId);
  if (delError) throw new Error(delError.message);
}

// Chame antes de apagar uma solicitação manualmente (não há tela no app pra
// isso hoje — só acontece via limpeza administrativa direta no banco) pra não
// deixar arquivo órfão no Storage: o ON DELETE CASCADE da tabela só apaga a
// linha, nunca o arquivo de fato.
export async function deleteRequestPhotos(requestId: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const { data: rows, error } = await admin
    .from("service_request_photos")
    .select("storage_path")
    .eq("request_id", requestId);
  if (error) throw new Error(error.message);
  if (rows && rows.length > 0) {
    await admin.storage.from(BUCKET).remove(rows.map((r) => r.storage_path as string));
  }
}
