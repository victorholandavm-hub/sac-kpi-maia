import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabaseAdmin", () => ({ getSupabaseAdmin: () => ({}) }));
const { comDataProgramada } = await import("./dataProgramada");

describe("data programada guardada", () => {
  it("mostra a do Jhon até a ponte devolver a mesma", () => {
    const { saidas, resolvidas } = comDataProgramada(
      [
        { picking_id: 1, data_programada: "2026-12-31 11:00:00" },
        { picking_id: 2, data_programada: "2026-10-31" },
        { picking_id: 3, data_programada: "2026-11-02" },
      ],
      new Map([
        [1, "2026-10-31"],
        [2, "2026-10-31"],
      ]),
    );
    expect(saidas.map((s) => s.data_programada)).toEqual(["2026-10-31", "2026-10-31", "2026-11-02"]);
    expect(resolvidas).toEqual([2]);
  });
});
