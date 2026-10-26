import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

let dir = "";
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "fotos-"));
  process.env.PHOTO_STORAGE_DIR = dir;
  const p = join(dir, "odoo-entregas", "carga-38", "parada-96");
  await mkdir(p, { recursive: true });
  await writeFile(join(p, "a.jpg"), "x");
  await writeFile(join(p, "b.png"), "x");
  await writeFile(join(p, "nota.txt"), "x");
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("fotosDaParadaOdoo", () => {
  it("lista só as imagens da parada, com a URL pública", async () => {
    const { fotosDaParadaOdoo } = await import("./fotosEntregaOdoo");
    const fotos = await fotosDaParadaOdoo(38, 96);
    expect(fotos.map((f) => f.url).sort()).toEqual([
      "/api/photos/odoo-entregas/carga-38/parada-96/a.jpg",
      "/api/photos/odoo-entregas/carga-38/parada-96/b.png",
    ]);
  });
  it("parada sem pasta ou id inválido devolve vazio", async () => {
    const { fotosDaParadaOdoo } = await import("./fotosEntregaOdoo");
    expect(await fotosDaParadaOdoo(38, 999)).toEqual([]);
    expect(await fotosDaParadaOdoo(-1, 96)).toEqual([]);
  });
});
