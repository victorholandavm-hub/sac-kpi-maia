// Migração ÚNICA das fotos que já estavam no Supabase Storage (bucket
// "service-request-photos") pro disco local do VPS, como parte da saída do
// Storage do Supabase (pedido do Victor 20/08/2026, ver
// src/lib/localPhotoStorage.ts pro motivo completo -- egress de foto tinha
// estourado 746% da cota gratuita).
//
// Uso (rodar UMA VEZ na VPS, ANTES de fazer deploy do código novo que já lê
// do disco local -- senão as fotos antigas ficam "quebradas" no meio tempo):
//   PHOTO_STORAGE_DIR=/home/victormoura/storage/service-request-photos \
//     node --env-file=.env.local scripts/migrate-photos-to-local.ts
//
// Lê o caminho de cada foto pelas duas tabelas que referenciam o bucket
// (service_request_photos e pedido_encomenda_photos -- ver
// src/lib/pedidoEncomendaPhotos.ts) em vez de listar o bucket direto: o que
// importa é o que o app de fato referencia, não o que sobrou solto no
// Storage (arquivo órfão nunca seria pedido de qualquer forma).
//
// Idempotente: pula arquivo que já existe no destino com o mesmo tamanho do
// Storage (dá pra rodar de novo sem medo, ex. se cair no meio).

import { getSupabaseAdmin } from "../src/lib/supabaseAdmin.ts";
import { savePhotoFile, photoStorageDir } from "../src/lib/localPhotoStorage.ts";
import { stat } from "node:fs/promises";
import { join } from "node:path";

const BUCKET = "service-request-photos";

async function alreadyMigrated(relativePath: string, expectedSize: number): Promise<boolean> {
  try {
    const s = await stat(join(photoStorageDir(), relativePath));
    return s.size === expectedSize;
  } catch {
    return false;
  }
}

async function migrateOne(relativePath: string): Promise<"copied" | "skipped" | "error"> {
  const admin = getSupabaseAdmin();

  // Storage list() dá o tamanho sem precisar baixar -- usado só pra decidir
  // se pula (ver alreadyMigrated). O download de verdade só acontece se
  // ainda não migrado.
  const parts = relativePath.split("/");
  const fileName = parts.pop()!;
  const dir = parts.join("/");
  const { data: listing } = await admin.storage.from(BUCKET).list(dir, { search: fileName });
  const meta = listing?.find((f) => f.name === fileName);
  if (meta?.metadata?.size && (await alreadyMigrated(relativePath, meta.metadata.size as number))) {
    return "skipped";
  }

  const { data, error } = await admin.storage.from(BUCKET).download(relativePath);
  if (error || !data) {
    console.error(`  ERRO baixando ${relativePath}:`, error?.message ?? "sem dado");
    return "error";
  }
  const buffer = Buffer.from(await data.arrayBuffer());
  await savePhotoFile(relativePath, buffer);
  return "copied";
}

async function migrateTable(table: "service_request_photos" | "pedido_encomenda_photos"): Promise<void> {
  const admin = getSupabaseAdmin();
  const paths: string[] = [];
  const PAGE_SIZE = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await admin.from(table).select("storage_path").range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    for (const row of data ?? []) paths.push(row.storage_path as string);
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  console.log(`${table}: ${paths.length} foto(s) referenciada(s).`);
  let copied = 0;
  let skipped = 0;
  let errors = 0;
  for (const path of paths) {
    const result = await migrateOne(path);
    if (result === "copied") copied++;
    else if (result === "skipped") skipped++;
    else errors++;
  }
  console.log(`${table}: ${copied} copiada(s), ${skipped} já migrada(s), ${errors} com erro.`);
  if (errors > 0) process.exitCode = 1;
}

async function main() {
  console.log(`Destino: ${photoStorageDir()}`);
  await migrateTable("service_request_photos");
  await migrateTable("pedido_encomenda_photos");
  console.log(process.exitCode === 1 ? "Terminou com erros -- ver acima." : "OK -- tudo migrado.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
