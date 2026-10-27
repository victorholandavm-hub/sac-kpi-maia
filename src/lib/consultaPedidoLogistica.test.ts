import { describe, it, expect, vi } from "vitest";

vi.mock("./supabaseAdmin", () => ({ getSupabaseAdmin: () => ({}) }));
const { modoDoProtheus, logisticaDoOdoo, agruparPedidosOdoo, situacaoDoOdoo } = await import("./consultaPedido");

const linha = (o: Partial<Parameters<typeof logisticaDoOdoo>[1][number]>) => ({ pedido: "S01589", modo: null, expresso: null, filial_entrega: null, retira_em: null, empresa: null, ...o });

describe("modoDoProtheus", () => {
  it("lê o tipo da saída do Protheus", () => {
    expect(modoDoProtheus("Entrega")).toBe("entrega");
    expect(modoDoProtheus("Express")).toBe("express");
    expect(modoDoProtheus("Retirada")).toBe("retira");
    expect(modoDoProtheus(null)).toBeNull();
  });
});

describe("logisticaDoOdoo", () => {
  it("retira na loja, com a loja de retirada", () => {
    expect(logisticaDoOdoo("216", [linha({ modo: "retira_depois", retira_em: "205 Mangabeira 1", empresa: "205 Mangabeira 1" })])).toMatchObject({
      filialVenda: "216",
      filialEntrega: "205",
      modo: "retira",
      retiraEm: "205 Mangabeira 1",
    });
  });
  it("prefere a linha da expedição à da carga e usa a filial de entrega dela", () => {
    const r = logisticaDoOdoo("212", [linha({ empresa: "213 CD" }), linha({ modo: "entrega", expresso: true, filial_entrega: "212", empresa: "212 Shopping" })]);
    expect(r).toMatchObject({ filialEntrega: "212", modo: "express" });
  });
  it("só a carga: filial de entrega pela empresa da carga, modo desconhecido", () => {
    expect(logisticaDoOdoo("205", [linha({ empresa: "213 CD" })])).toMatchObject({ filialEntrega: "213", modo: null });
  });
  it("sem nada na expedição", () => {
    expect(logisticaDoOdoo("205", [])).toEqual({ filialVenda: "205", filialEntrega: null, modo: null, retiraEm: null });
  });
});

describe("agruparPedidosOdoo", () => {
  const l = (o: Record<string, unknown>) => ({ pedido: "S01720", cliente: null, telefone: null, empresa: null, nf5922: null, nf5117: null, legado: false, modo: null, expresso: null, filial_entrega: null, retira_em: null, ...o });
  it("junta expedição e carga do mesmo pedido e pula o que já aparece pelo sync", () => {
    const r = agruparPedidosOdoo(
      [
        l({ cliente: "ANA", empresa: "213 CD" }),
        l({ cliente: "ANA", telefone: "83 9999", nf5922: "23787", modo: "retira_depois", retira_em: "205 Mangabeira 1", empresa: "205 Mangabeira 1" }),
        l({ pedido: "S01589", cliente: "JOSE" }),
      ],
      new Set(["S01589"])
    );
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ pedido: "S01720", cliente: "ANA", telefone: "83 9999", nf5922: "23787", logistica: { modo: "retira", retiraEm: "205 Mangabeira 1" } });
  });
});

describe("situacaoDoOdoo", () => {
  const base = { pedido: "S01", modo: "entrega", expresso: false, filial_entrega: null, retira_em: null, empresa: "213 CD" };
  it("na fila: aguardando carga com a data programada; pendência tem prioridade", () => {
    expect(situacaoDoOdoo([{ ...base, data_programada: "2026-10-28" }], "entrega")).toMatchObject({ texto: "Aguardando carga", tom: "neutro", carga: null, detalhes: ["programado 28/10/2026"] });
    expect(situacaoDoOdoo([{ ...base, pendencia_motivo: "falta produto" }], "entrega")?.texto).toBe("Pendência: falta produto");
  });
  it("em separação e em rota mostram a carga e a previsão", () => {
    const r = situacaoDoOdoo([{ ...base, carga_id: 77, carga_romaneio: "ROM/2026/00063", carga_estado: "separacao", carga_prevista: "2026-10-27" }], "entrega");
    expect(r).toMatchObject({ texto: "Em separação", tom: "neutro", carga: "ROM/2026/00063", cargaId: 77, detalhes: ["carga prevista 27/10/2026"] });
    expect(situacaoDoOdoo([{ ...base, carga_id: 77, carga_romaneio: "ROM/2026/00063", carga_estado: "em_rota" }], "entrega")?.texto).toBe("Saiu para entrega");
  });
  it("resultado da parada: entregue; e o pedido que voltou pra fila", () => {
    expect(situacaoDoOdoo([{ ...base, carga_id: 73, carga_romaneio: "ROM/2026/00059", carga_estado: "finalizada", resultado: "entregue" }], "entrega")?.texto).toBe("Entregue");
    expect(situacaoDoOdoo([{ ...base, resultado: "insucesso" }], "entrega")).toMatchObject({ texto: "Voltou da entrega, aguardando nova carga", tom: "critico" });
  });
  it("vale a carga mais recente e retirada aguarda o cliente", () => {
    const r = situacaoDoOdoo(
      [
        { ...base, modo: null, carga_id: 50, carga_romaneio: "ROM/2026/00040", carga_estado: "finalizada", resultado: "insucesso" },
        { ...base, modo: null, carga_id: 70, carga_romaneio: "ROM/2026/00056", carga_estado: "em_rota" },
      ],
      "entrega"
    );
    expect(r).toMatchObject({ texto: "Saiu para entrega", carga: "ROM/2026/00056" });
    expect(situacaoDoOdoo([{ ...base, modo: "retira_depois" }], "retira")?.texto).toBe("Aguardando o cliente retirar");
  });
});

describe("situacaoDoOdoo: motorista e fotos", () => {
  const base = { pedido: "S01", modo: "entrega", expresso: false, filial_entrega: null, retira_em: null, empresa: "213 CD" };
  it("motorista da carga atual e fotos da parada", () => {
    const r = situacaoDoOdoo(
      [{ ...base, carga_id: 80, carga_romaneio: "ROM/2026/00066", carga_estado: "em_rota", carga_motorista: "Douglas", carga_veiculo: "HTT0D75", parada_id: 501, ultima_carga_id: 80 }],
      "entrega"
    );
    expect(r).toMatchObject({ texto: "Saiu para entrega", motorista: "Douglas", veiculo: "HTT0D75", fotoRef: { cargaId: 80, paradaId: 501 } });
  });
  it("voltou pra fila: sem motorista atual, mas as fotos da tentativa ficam", () => {
    const r = situacaoDoOdoo([{ ...base, resultado: "insucesso", carga_motorista: "Isaac", parada_id: 77, ultima_carga_id: 65 }], "entrega");
    expect(r).toMatchObject({ texto: "Voltou da entrega, aguardando nova carga", motorista: null, fotoRef: { cargaId: 65, paradaId: 77 } });
  });
});
