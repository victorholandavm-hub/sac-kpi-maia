import { describe, it, expect } from "vitest";
import { outrosPedidosDoCliente } from "./outrosPedidosCliente";
import type { EntregaOdoo } from "./logisticaTipos";

const s = (picking_id: number, pedido: string, cliente: string, cliente_id: number, pendencia = false) =>
  ({ picking_id, pedido, cliente, cliente_id, nome: `CD/OUT/${picking_id}`, pendencia, pendencia_motivo: pendencia ? "falta a box" : "", data_programada: false }) as unknown as EntregaOdoo;

describe("outros pedidos do cliente", () => {
  const todas = [s(1, "S1", "MARIA", 10), s(2, "S2", "MARIA", 10, true), s(3, "S3", "JOSE", 11), s(4, "S4", "Joana", 0), s(5, "S5", "JOANA", 0)];
  it("avisa as saídas não marcadas do mesmo cliente (id ou nome)", () => {
    const a = outrosPedidosDoCliente(todas, new Set([1, 3, 4]));
    expect(a.map((x) => [x.cliente, x.outros.map((o) => o.pedido)])).toEqual([
      ["MARIA", ["S2"]],
      ["Joana", ["S5"]],
    ]);
  });
  it("nada a avisar quando todas do cliente estão marcadas", () => {
    expect(outrosPedidosDoCliente(todas, new Set([1, 2]))).toEqual([]);
  });
});
