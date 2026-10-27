import { describe, it, expect, vi } from "vitest";

vi.mock("./supabaseAdmin", () => ({ getSupabaseAdmin: () => ({}) }));
vi.mock("./totvsSync", () => ({
  totvsHeaders: () => ({}),
  consertarAcentos: (s: string) => s,
  ddmmyyyyToIso: (v: string) => (v ? v.split("/").reverse().join("-") : null),
}));
const { vendasQueFaltam } = await import("./completarVendasProtheus");

const v = (invoice: string, branch: string, date = "30/09/2026") => ({ invoice, serie: "1", branch, date, type: "Venda" });

describe("vendasQueFaltam", () => {
  it("só o que não está na base, sem repetir e só do dia pedido", () => {
    const r = vendasQueFaltam(
      [v("000023797", "207"), v("000023797", "202"), v("000025542", "202"), v("000025542", "202"), v("000099999", "202", "29/09/2026")],
      new Set(["000023797|1|202"]),
      "2026-09-30"
    );
    expect(r.map((x) => `${x.branch}/${x.invoice}`)).toEqual(["207/000023797", "202/000025542"]);
  });
});
