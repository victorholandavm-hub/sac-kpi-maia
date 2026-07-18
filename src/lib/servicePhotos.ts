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
};

export type RequestPhoto = {
  id: string;
  url: string;
  uploadedBy: string | null;
  caption: string | null;
  createdAt: string;
};

export async function listRequestPhotos(requestId: string): Promise<RequestPhoto[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("service_request_photos")
    .select("id, storage_path, uploaded_by, caption, created_at")
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
        uploadedBy: row.uploaded_by as string | null,
        caption: row.caption as string | null,
        createdAt: row.created_at as string,
      };
    })
  );
}

export async function saveRequestPhoto(opts: {
  requestId: string;
  file: File;
  uploadedBy: string | null;
  caption?: string | null;
}): Promise<void> {
  const ext = ALLOWED_TYPES[opts.file.type];
  if (!ext) {
    throw new Error("Formato de imagem não suportado. Envie uma foto em JPEG, PNG, WEBP ou HEIC.");
  }
  if (opts.file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error("A foto é grande demais (máximo 10 MB).");
  }

  const admin = getSupabaseAdmin();
  const path = `${opts.requestId}/${randomUUID()}.${ext}`;

  const buffer = Buffer.from(await opts.file.arrayBuffer());
  const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, buffer, {
    contentType: opts.file.type,
  });
  if (uploadError) {
    console.error("saveRequestPhoto upload failed:", uploadError.message);
    throw new Error("Não foi possível enviar a foto agora. Tente de novo em instantes.");
  }

  const caption = opts.caption?.trim() || null;
  const { error: insertError } = await admin.from("service_request_photos").insert({
    request_id: opts.requestId,
    storage_path: path,
    uploaded_by: opts.uploadedBy,
    caption,
  });
  if (insertError) {
    console.error("saveRequestPhoto insert failed:", insertError.message);
    await admin.storage.from(BUCKET).remove([path]);
    throw new Error("Não foi possível salvar a foto agora. Tente de novo em instantes.");
  }
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
