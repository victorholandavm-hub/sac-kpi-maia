import { randomUUID } from "crypto";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { getCachedSignedUrl } from "./signedPhotoUrl";

// Mesmo bucket de src/lib/servicePhotos.ts (privado, só URL assinada) — só
// muda o prefixo do path, pra não colidir com fotos de service_requests.
const BUCKET = "service-request-photos";
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

export type EncomendaPhoto = {
  id: string;
  url: string;
  uploadedBy: string | null;
  caption: string | null;
  createdAt: string;
};

export async function listEncomendaPhotos(pedidoId: string): Promise<EncomendaPhoto[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("pedido_encomenda_photos")
    .select("id, storage_path, uploaded_by, caption, created_at, signed_url, signed_url_expires_at")
    .eq("pedido_id", pedidoId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  return Promise.all(
    rows.map(async (row) => {
      const url = await getCachedSignedUrl({
        admin,
        bucket: BUCKET,
        table: "pedido_encomenda_photos",
        id: row.id as string,
        storagePath: row.storage_path as string,
        cachedUrl: row.signed_url as string | null,
        cachedExpiresAt: row.signed_url_expires_at as string | null,
        ttlSeconds: SIGNED_URL_TTL_SECONDS,
      });
      return {
        id: row.id as string,
        url,
        uploadedBy: row.uploaded_by as string | null,
        caption: row.caption as string | null,
        createdAt: row.created_at as string,
      };
    })
  );
}

// Batched pra tela da caixa, que lista vários pedidos de uma vez (mesma razão
// de listEventsForPedidos em src/lib/pedidosEncomenda.ts).
export async function listEncomendaPhotosForPedidos(pedidoIds: string[]): Promise<Map<string, EncomendaPhoto[]>> {
  const map = new Map<string, EncomendaPhoto[]>();
  if (pedidoIds.length === 0) return map;

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("pedido_encomenda_photos")
    .select("id, pedido_id, storage_path, uploaded_by, caption, created_at, signed_url, signed_url_expires_at")
    .in("pedido_id", pedidoIds)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    const url = await getCachedSignedUrl({
      admin,
      bucket: BUCKET,
      table: "pedido_encomenda_photos",
      id: row.id as string,
      storagePath: row.storage_path as string,
      cachedUrl: row.signed_url as string | null,
      cachedExpiresAt: row.signed_url_expires_at as string | null,
      ttlSeconds: SIGNED_URL_TTL_SECONDS,
    });
    const photo: EncomendaPhoto = {
      id: row.id as string,
      url,
      uploadedBy: row.uploaded_by as string | null,
      caption: row.caption as string | null,
      createdAt: row.created_at as string,
    };
    const list = map.get(row.pedido_id as string);
    if (list) list.push(photo);
    else map.set(row.pedido_id as string, [photo]);
  }

  return map;
}

export async function saveEncomendaPhoto(opts: {
  pedidoId: string;
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
  const path = `encomenda/${opts.pedidoId}/${randomUUID()}.${ext}`;

  const buffer = Buffer.from(await opts.file.arrayBuffer());
  const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, buffer, {
    contentType: opts.file.type,
  });
  if (uploadError) {
    console.error("saveEncomendaPhoto upload failed:", uploadError.message);
    throw new Error("Não foi possível enviar a foto agora. Tente de novo em instantes.");
  }

  const caption = opts.caption?.trim() || null;
  const { error: insertError } = await admin.from("pedido_encomenda_photos").insert({
    pedido_id: opts.pedidoId,
    storage_path: path,
    uploaded_by: opts.uploadedBy,
    caption,
  });
  if (insertError) {
    console.error("saveEncomendaPhoto insert failed:", insertError.message);
    await admin.storage.from(BUCKET).remove([path]);
    throw new Error("Não foi possível salvar a foto agora. Tente de novo em instantes.");
  }
}
