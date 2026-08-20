import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";

// Fotos saíram do Supabase Storage pra disco local do próprio VPS (pedido do
// Victor 20/08/2026, repassando orientação do Thiago/TI: "rodar tudo na
// máquina local, não depender de infraestrutura externa") -- egress de foto
// (imagem de celular sem compressão, servida em tamanho real até pra
// miniatura de 80x80px) tinha estourado 746% da cota gratuita do Supabase
// num banco de só 0,1 GB. Banco (Postgres) continua no Supabase -- não é ele
// o problema (egress de 0,7 MB/dia, bem dentro do limite grátis) e migrar um
// banco relacional vivo é bem mais arriscado do que precisa ser agora.
//
// `PHOTO_STORAGE_DIR` precisa apontar pro MESMO diretório físico nas 4
// instâncias PM2 (sac/assistencia/sac-ip/assistencia-ip) -- elas compartilham
// o mesmo banco (mesmas linhas de service_request_photos), então uma foto
// subida por qualquer uma das 4 precisa ser lida pelas outras 3. Como as 4
// rodam no mesmo VPS, um diretório fora dos 4 checkouts do repo resolve isso
// (`git pull` nunca mexe nele). Fora do VPS (dev local), cai num diretório
// dentro do próprio projeto, ignorado pelo git.
// Exportado só pro script de migração one-off (scripts/migrate-photos-to-local.ts)
// decidir se um arquivo já foi copiado -- nenhum outro chamador de dentro do
// app deveria precisar do caminho bruto, só das funções acima.
export function photoStorageDir(): string {
  return process.env.PHOTO_STORAGE_DIR ?? join(process.cwd(), ".local-storage", "service-request-photos");
}

// Caminho vem de `${requestId}/${randomUUID()}.${ext}` sempre que a gente
// mesmo gera (upload) -- nunca de entrada externa. Mas quem SERVE a foto (a
// rota /api/photos/[...path]) recebe o caminho de volta pela URL, aí sim é
// entrada não confiável -- essa checagem central garante que nenhum ".."
// consiga escapar de photoStorageDir() nos dois casos, sem precisar duplicar
// a validação em cada chamador.
function resolveWithinStorageDir(relativePath: string): string {
  const base = resolve(photoStorageDir());
  const target = resolve(base, relativePath);
  if (target !== base && !target.startsWith(base + sep)) {
    throw new Error("Caminho de foto inválido.");
  }
  return target;
}

export async function savePhotoFile(relativePath: string, buffer: Buffer): Promise<void> {
  const target = resolveWithinStorageDir(relativePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, buffer);
}

export async function readPhotoFile(relativePath: string): Promise<Buffer | null> {
  try {
    const target = resolveWithinStorageDir(relativePath);
    return await readFile(target);
  } catch {
    // Cobre tanto "arquivo não existe" (ENOENT, o caso normal de foto
    // apagada/nunca migrada) quanto o caminho inválido lançado acima --
    // pra quem serve a foto (rota da API), as duas situações viram 404 do
    // mesmo jeito, sem precisar distinguir.
    return null;
  }
}

export async function deletePhotoFile(relativePath: string): Promise<void> {
  try {
    await unlink(resolveWithinStorageDir(relativePath));
  } catch {
    // Idempotente -- apagar o que já não existe (ou nunca existiu, ex.:
    // upload que falhou antes de chegar aqui) não é erro.
  }
}

export async function deletePhotoFiles(relativePaths: string[]): Promise<void> {
  await Promise.all(relativePaths.map((p) => deletePhotoFile(p)));
}

// Estável pra sempre (o nome do arquivo já tem um UUID único, nunca muda) --
// diferente da URL assinada de antes, que precisava ser regenerada perto do
// vencimento (e um bug de regeneração cedo demais chegou a gerar 1025
// downloads da mesma foto num único dia, ver signedPhotoUrl.ts no histórico).
// Sem vencimento, o Cache-Control forte da rota finalmente cacheia de
// verdade no navegador.
export function photoPublicUrl(relativePath: string): string {
  return `/api/photos/${relativePath.split("/").map(encodeURIComponent).join("/")}`;
}
