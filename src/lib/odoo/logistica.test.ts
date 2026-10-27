import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OdooBridgeError, executarAcaoCarga, lerExpedicao, limparCacheExpedicao, registrarResultadoParada } from "./logistica";

const fetchMock = vi.fn();

beforeEach(() => {
  limparCacheExpedicao();
  vi.stubGlobal("fetch", fetchMock);
  process.env.ODOO_BRIDGE_URL = "https://ponte.test/api/odoo/";
  process.env.ODOO_KEY_LOGISTICA = "k-log";
  process.env.ODOO_KEY_MOTORISTA = "k-mot";
});
afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

function resposta(status: number, corpo: unknown) {
  return new Response(typeof corpo === "string" ? corpo : JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } });
}

describe("cliente da ponte Odoo", () => {
  it("manda a chave em header (nunca na URL) e monta a query", async () => {
    fetchMock.mockResolvedValue(resposta(200, { ok: true, entregas: [], pendencias: [] }));
    await lerExpedicao(13);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://ponte.test/api/odoo/logistica/expedicao?company_id=13&dias=90");
    expect(String(url)).not.toContain("k-log");
    expect(init.headers["X-Maia-Key"]).toBe("k-log");
    expect(init.headers["X-Maia-Perfil"]).toBe("logistica");
  });
  it("erro do Odoo (ok:false) vira OdooBridgeError com a mensagem real", async () => {
    fetchMock.mockResolvedValue(resposta(400, { ok: false, erro: "liberar exige motorista e veículo" }));
    await expect(executarAcaoCarga(5, "liberar", { operador: "CD x" })).rejects.toThrow("liberar exige motorista e veículo");
  });
  it("401 explica a chave; corpo não-JSON não passa calado", async () => {
    fetchMock.mockResolvedValueOnce(resposta(401, { ok: false, erro: "sem autorizacao" }));
    await expect(lerExpedicao(13)).rejects.toThrow(/401/);
    fetchMock.mockResolvedValueOnce(new Response("<html>502</html>", { status: 502 }));
    await expect(lerExpedicao(13)).rejects.toBeInstanceOf(OdooBridgeError);
  });
  it("timeout/rede vira erro explícito", async () => {
    fetchMock.mockRejectedValue(Object.assign(new Error("x"), { name: "TimeoutError" }));
    await expect(lerExpedicao(13)).rejects.toThrow(/não respondeu/);
  });
  it("sem chave configurada falha fechado", async () => {
    delete process.env.ODOO_KEY_MOTORISTA;
    await expect(registrarResultadoParada(1, { resultado: "entregue" })).rejects.toThrow(/ODOO_KEY_MOTORISTA/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("insucesso sem motivo é barrado antes da rede; parada usa o perfil motorista", async () => {
    process.env.ODOO_KEY_MOTORISTA = "k-mot";
    expect(() => registrarResultadoParada(1, { resultado: "insucesso" })).toThrow(/motivo/);
    fetchMock.mockResolvedValue(resposta(200, { ok: true, pendentes: 0 }));
    await registrarResultadoParada(7, { resultado: "insucesso", motivo: "cliente_ausente", geo_lat: -7.1, geo_lng: -34.8 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://ponte.test/api/odoo/logistica/parada/7");
    expect(init.headers["X-Maia-Perfil"]).toBe("motorista");
    expect(JSON.parse(init.body)).toMatchObject({ resultado: "insucesso", motivo: "cliente_ausente", origem: "app" });
  });
});
