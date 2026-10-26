import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./totvsSync", () => ({ totvsHeaders: () => ({ ApiKey: "k" }), consertarAcentos: (s: string) => s }));
const { clientesDoCadastro } = await import("./clienteCadastro");

describe("clientesDoCadastro", () => {
  beforeEach(() => {
    process.env.TOTVS_API_BASE_URL = "https://exemplo/api/odoo/compat";
  });
  it("devolve só o cliente com exatamente esse documento", async () => {
    const fetchMock = vi.fn<(url: string) => Promise<Response>>(async () =>
      new Response(
        JSON.stringify({
          data: [
            { id: "124775", cpf_cnpj: "04682762460", name: " JANICLEIDE FERNANDES DA CRUZ ", phone1: "83 988450409", lastPurchase: "30/09/2026" },
            { id: "9", cpf_cnpj: "04682762461", name: "OUTRA" },
          ],
        })
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    expect(await clientesDoCadastro("046.827.624-60")).toEqual([
      { codigo: "124775", nome: "JANICLEIDE FERNANDES DA CRUZ", documento: "04682762460", telefone: "83 988450409", ultimaCompra: "30/09/2026" },
    ]);
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://exemplo/api/odoo/compat/rest/client?SearchQuery=04682762460&Page=1&Size=5");
  });
  it("documento inválido não chama nada; erro HTTP vira exceção", async () => {
    const fetchMock = vi.fn<(url: string) => Promise<Response>>(async () => new Response("x", { status: 504 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await clientesDoCadastro("123")).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(clientesDoCadastro("04682762460")).rejects.toThrow(/504/);
  });
});
