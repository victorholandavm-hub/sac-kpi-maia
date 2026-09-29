import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

// Backup diário saiu do Supabase Storage pra disco local -- mesmo motivo/
// pedido do Victor 20/08/2026 (Thiago/TI: "rodar tudo na máquina local, não
// depender de infraestrutura externa"), agora estendido ao banco inteiro
// (migração pra Supabase self-hosted na própria VPS, 29/09/2026). Mesmo
// padrão de localPhotoStorage.ts: `BACKUP_STORAGE_DIR` precisa apontar pro
// MESMO diretório físico nas 4 instâncias PM2 (não importa qual delas rodou
// o cron), fora dos 4 checkouts do repo (git pull nunca mexe nele).
function backupStorageDir(): string {
  return process.env.BACKUP_STORAGE_DIR ?? join(process.cwd(), ".local-storage", "system-backups");
}

export async function writeBackupFile(fileName: string, contents: string): Promise<void> {
  const dir = backupStorageDir();
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, fileName), contents, "utf-8");
}

export async function listBackupFiles(): Promise<string[]> {
  try {
    return await readdir(backupStorageDir());
  } catch {
    return [];
  }
}

export async function readBackupFile(fileName: string): Promise<string | null> {
  try {
    return await readFile(join(backupStorageDir(), fileName), "utf-8");
  } catch {
    return null;
  }
}

export async function deleteBackupFiles(fileNames: string[]): Promise<void> {
  await Promise.all(
    fileNames.map((name) =>
      unlink(join(backupStorageDir(), name)).catch(() => {
        // Idempotente -- mesmo motivo de deletePhotoFile em localPhotoStorage.ts.
      })
    )
  );
}
