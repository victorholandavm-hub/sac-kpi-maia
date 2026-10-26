import { readdir, stat } from "fs/promises";
import { join } from "path";
import { photoStorageDir, photoPublicUrl } from "./localPhotoStorage";

// Fotos que o motorista tira na baixa da entrega do Odoo (app do Pedro,
// assistencia/motorista/odoo/foto): ficam no disco de fotos deste sistema em
// odoo-entregas/carga-<id>/parada-<id>/ -- o Odoo só recebe o link na
// observação. A consulta de pedido mostra as da parada de cada tentativa
// (Victor 26/10/2026: "os atendentes do sac precisam ver isso"). O tipo
// (canhoto/mercadoria/local) só existe no Odoo; quando a ponte devolver,
// entra por cima (ver consultaPedido.ts).
export type FotoEntrega = { url: string; tipo?: string | null; em?: string };

const EXTENSOES = /\.(jpe?g|png|webp|heic|heif)$/i;

export async function fotosDaParadaOdoo(cargaId: number, paradaId: number): Promise<FotoEntrega[]> {
  if (!Number.isInteger(cargaId) || !Number.isInteger(paradaId) || cargaId <= 0 || paradaId <= 0) return [];
  const relativo = `odoo-entregas/carga-${cargaId}/parada-${paradaId}`;
  let nomes: string[];
  try {
    nomes = await readdir(join(photoStorageDir(), relativo));
  } catch {
    return [];
  }
  const fotos = await Promise.all(
    nomes
      .filter((n) => EXTENSOES.test(n))
      .map(async (n) => {
        const info = await stat(join(photoStorageDir(), relativo, n)).catch(() => null);
        return { url: photoPublicUrl(`${relativo}/${n}`), em: info?.mtime.toISOString() };
      })
  );
  return fotos.sort((a, b) => (a.em ?? "").localeCompare(b.em ?? ""));
}
