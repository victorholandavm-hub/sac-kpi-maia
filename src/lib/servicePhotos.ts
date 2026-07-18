import { randomUUID } from "crypto";
import { getSupabaseAdmin } from "./supabaseAdmin";

const BUCKET = "service-request-photos";
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hora — tempo suficiente pra abrir a página e ver as fotos

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
}): Promise<void> {
  if (!opts.file.type.startsWith("image/")) {
    throw new Error("Só é possível anexar imagens.");
  }

  const admin = getSupabaseAdmin();
  const ext = opts.file.name.split(".").pop() || "jpg";
  const path = `${opts.requestId}/${randomUUID()}.${ext}`;

  const buffer = Buffer.from(await opts.file.arrayBuffer());
  const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, buffer, {
    contentType: opts.file.type || "image/jpeg",
  });
  if (uploadError) throw new Error(uploadError.message);

  const { error: insertError } = await admin.from("service_request_photos").insert({
    request_id: opts.requestId,
    storage_path: path,
    uploaded_by: opts.uploadedBy,
  });
  if (insertError) throw new Error(insertError.message);
}
