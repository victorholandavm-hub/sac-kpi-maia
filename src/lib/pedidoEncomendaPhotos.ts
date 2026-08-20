import { randomUUID } from "crypto";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { savePhotoFile, deletePhotoFile, photoPublicUrl } from "./localPhotoStorage";

// Mesmo diretório local de src/lib/servicePhotos.ts (ver localPhotoStorage.ts
// -- fotos saíram do Supabase Storage pro disco do VPS, pedido do Victor
// 20/08/2026) — só muda o prefixo do path, pra não colidir com fotos de
// service_requests.
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
    .select("id, storage_path, uploaded_by, caption, created_at")
    .eq("pedido_id", pedidoId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    url: photoPublicUrl(row.storage_path as string),
    uploadedBy: row.uploaded_by as string | null,
    caption: row.caption as string | null,
    createdAt: row.created_at as string,
  }));
}

// Batched pra tela da caixa, que lista vários pedidos de uma vez (mesma razão
// de listEventsForPedidos em src/lib/pedidosEncomenda.ts).
export async function listEncomendaPhotosForPedidos(pedidoIds: string[]): Promise<Map<string, EncomendaPhoto[]>> {
  const map = new Map<string, EncomendaPhoto[]>();
  if (pedidoIds.length === 0) return map;

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("pedido_encomenda_photos")
    .select("id, pedido_id, storage_path, uploaded_by, caption, created_at")
    .in("pedido_id", pedidoIds)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    const photo: EncomendaPhoto = {
      id: row.id as string,
      url: photoPublicUrl(row.storage_path as string),
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
  try {
    await savePhotoFile(path, buffer);
  } catch (err) {
    console.error("saveEncomendaPhoto upload failed:", err);
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
    await deletePhotoFile(path);
    throw new Error("Não foi possível salvar a foto agora. Tente de novo em instantes.");
  }
}
