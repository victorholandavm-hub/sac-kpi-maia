import { describe, it, expect, vi } from "vitest";

const { fotosUmovDoPedido } = await import("./consultaOdooPonte");

describe("fotosUmovDoPedido", () => {
  it("foto pública fica como está; foto do acervo antigo passa pela nossa rota", async () => {
    process.env.ODOO_BRIDGE_URL = "https://ponte/api/odoo";
    process.env.ODOO_KEY_LOGISTICA = "k";
    const fetchMock = vi.fn<(url: string) => Promise<Response>>(async () =>
      new Response(
        JSON.stringify({
          tarefas: [
            { carga: "005575", fotos: [{ url: "https://picviewer.umov.me/Pic/GetImage?id=1", legenda: "Foto 1" }] },
            { carga: "004100", fotos: [{ url: "/umov/foto-legado/abc-123", legenda: "" }, { url: "" }] },
          ],
        })
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    expect(await fotosUmovDoPedido("025709", "207")).toEqual([
      { carga: "005575", fotos: [{ url: "https://picviewer.umov.me/Pic/GetImage?id=1", legenda: "Foto 1" }] },
      { carga: "004100", fotos: [{ url: "/assistencia/umov-foto/abc-123", legenda: null }] },
    ]);
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://ponte/api/odoo/umov/fotos?pedido=025709&filial=207");
    await fotosUmovDoPedido("025709", "207");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
