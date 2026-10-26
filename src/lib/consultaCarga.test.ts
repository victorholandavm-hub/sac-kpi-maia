import { describe, it, expect, vi } from "vitest";

const carga = (carga_id: number, romaneio: string, criada_em: string) => ({ carga_id, romaneio, criada_em });
const listarCargas = vi.fn(async (companyId: number) => {
  if (companyId === 13) return [carga(77, "ROM/2026/00063", "2026-10-26 14:00:00"), carga(72, "ROM/2026/00058", "2026-10-26 10:00:00")];
  if (companyId === 22) return [carga(90, "ROM/2026/00200", "2026-10-26 09:00:00")];
  return [];
});
vi.mock("./odoo/logistica", () => ({
  listarEmpresas: vi.fn(async () => [
    { id: 21, name: "207 Mangabeira" },
    { id: 13, name: "213 CD" },
    { id: 22, name: "208 GL" },
  ]),
  listarCargas: (id: number) => listarCargas(id),
  lerCarga: vi.fn(),
  mensagemDeErro: (e: unknown) => (e as Error).message,
}));
vi.mock("./fotosEntregaOdoo", () => ({ fotosDaParadaOdoo: vi.fn(async () => []) }));

const { numeroDaCarga, acharCarga } = await import("./consultaCarga");

describe("numeroDaCarga", () => {
  it("reconhece o romaneio e 'carga N', e deixa número solto para a busca de pedido", () => {
    expect(numeroDaCarga("ROM/2026/00058")).toEqual({ ano: "2026", numero: 58 });
    expect(numeroDaCarga(" rom 58 ")).toEqual({ ano: null, numero: 58 });
    expect(numeroDaCarga("carga 58")).toEqual({ ano: null, numero: 58 });
    expect(numeroDaCarga("Carga ROM/2026/58")).toEqual({ ano: "2026", numero: 58 });
    expect(numeroDaCarga("062427")).toBeNull();
    expect(numeroDaCarga("romero silva")).toBeNull();
  });
});

describe("acharCarga", () => {
  it("acha no CD sem consultar as lojas", async () => {
    listarCargas.mockClear();
    expect((await acharCarga({ ano: "2026", numero: 58 }))?.carga_id).toBe(72);
    expect(listarCargas.mock.calls.map((c) => c[0])).toEqual([13]);
  });
  it("vai nas lojas quando o CD não tem, e devolve null quando ninguém tem", async () => {
    expect((await acharCarga({ ano: null, numero: 200 }))?.carga_id).toBe(90);
    expect(await acharCarga({ ano: null, numero: 999 })).toBeNull();
  });
});
