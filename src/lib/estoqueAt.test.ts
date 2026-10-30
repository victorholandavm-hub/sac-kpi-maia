import { describe, it, expect } from "vitest";
import { planejarEstoqueAt, type ItemEstoque, type MovEstoque, type ReqEstoque } from "./estoqueAt";

const req = (id: string, type: string, status = "aberta"): ReqEstoque => ({ id, ticket_number: 100, type, status });
const item = (id: string, request_id: string, extra: Partial<ItemEstoque> = {}): ItemEstoque => ({ id, request_id, part_code: "070001", quantity: 1, is_pickup: false, destino: null, ...extra });
const mov = (extra: Partial<MovEstoque>): MovEstoque => ({
  id: "m1", request_id: "r1", item_id: "i1", etapa: "reserva", desfaz: null, codigo: "070001", qtd: 1, origem: "estoque", destino: "assistencia", situacao: "feito", tentativas: 1, ...extra,
});
const plano = (reqs: ReqEstoque[], itens: ItemEstoque[], movs: MovEstoque[] = [], recolhidos = true) => planejarEstoqueAt(reqs, itens, movs, { recolhidos });

describe("planejarEstoqueAt", () => {
  it("troca aberta: o produto a entregar vai do CD pro AT; o recolhido não", () => {
    const a = plano([req("r1", "troca_produto")], [item("i1", "r1"), item("i2", "r1", { is_pickup: true })]);
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ etapa: "reserva", item_id: "i1", origem: "estoque", destino: "assistencia" });
  });

  it("não repete a reserva feita; tenta de novo a que ficou sem saldo", () => {
    expect(plano([req("r1", "entrega_produto")], [item("i1", "r1")], [mov({})])).toEqual([]);
    const a = plano([req("r1", "entrega_produto")], [item("i1", "r1")], [mov({ situacao: "sem_saldo" })]);
    expect(a[0]?.existente?.id).toBe("m1");
  });

  it("para de tentar depois de 5 erros", () => {
    expect(plano([req("r1", "entrega_produto")], [item("i1", "r1")], [mov({ situacao: "erro", tentativas: 5 })])).toEqual([]);
  });

  it("cancelada: devolve ao CD o que foi pro AT, uma vez só", () => {
    const a = plano([req("r1", "troca_produto", "cancelada")], [item("i1", "r1")], [mov({})]);
    expect(a).toEqual([expect.objectContaining({ etapa: "estorno", desfaz: "m1", origem: "assistencia", destino: "estoque" })]);
    expect(plano([req("r1", "troca_produto", "cancelada")], [item("i1", "r1")], [mov({}), mov({ id: "m2", etapa: "estorno", item_id: null, desfaz: "m1" })])).toEqual([]);
  });

  it("concluída: não reserva mais e não devolve", () => {
    expect(plano([req("r1", "troca_produto", "concluida")], [item("i1", "r1")])).toEqual([]);
    expect(plano([req("r1", "troca_produto", "concluida")], [], [mov({ item_id: null })])).toEqual([]);
  });

  it("item retirado numa edição: a reserva dele volta", () => {
    const a = plano([req("r1", "troca_produto")], [item("i9", "r1", { part_code: "070002" })], [mov({ item_id: null })]);
    expect(a.map((x) => x.etapa).sort()).toEqual(["estorno", "reserva"]);
  });

  it("recolhido classificado: estoque -> CD, pequena avaria e fábrica -> Avaria, o resto fica no AT", () => {
    const r = [req("r1", "troca_produto"), req("r2", "recolhimento_produto")];
    const itens = [
      item("a", "r1", { is_pickup: true, destino: "estoque" }),
      item("b", "r1", { is_pickup: true, destino: "pequena_avaria" }),
      item("c", "r2", { destino: "fabrica" }),
      item("d", "r2", { destino: "conserto" }),
      item("e", "r2", { destino: "mostruario" }),
      item("f", "r2", { destino: null }),
    ];
    const a = plano(r, itens).filter((x) => x.etapa === "destino");
    expect(a.map((x) => [x.item_id, x.destino])).toEqual([["a", "estoque"], ["b", "avaria"], ["c", "avaria"]]);
    expect(plano(r, itens, [], false).filter((x) => x.etapa === "destino")).toEqual([]);
  });

  it("peça não mexe no estoque", () => {
    const tipos = ["envio_peca", "troca_peca", "envio_recolhimento_peca", "recolhimento"];
    expect(plano(tipos.map((t, n) => req(`r${n}`, t)), tipos.map((_, n) => item(`i${n}`, `r${n}`, { destino: "estoque", is_pickup: n % 2 === 0 })))).toEqual([]);
  });
});
