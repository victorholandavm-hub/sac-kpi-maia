import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";

const respostas = new Map<string, { status: number; corpo: unknown }>();
const chamadas: string[] = [];
vi.mock("node:https", () => {
  class Agent {}
  return {
    default: {
      Agent,
      get: (url: string, _o: unknown, cb: (res: EventEmitter & { statusCode: number }) => void) => {
        const caminho = url.replace(/^https:\/\/[^/]+\/rest/, "");
        chamadas.push(caminho);
        const r = respostas.get(caminho) ?? { status: 404, corpo: { message: "nao" } };
        const res = Object.assign(new EventEmitter(), { statusCode: r.status });
        setTimeout(() => {
          cb(res);
          res.emit("data", Buffer.from(JSON.stringify(r.corpo)));
          res.emit("end");
        }, 0);
        return Object.assign(new EventEmitter(), { destroy() {} });
      },
    },
  };
});
const arquivos = new Map<string, unknown>();
vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(async () => undefined),
  writeFile: vi.fn(async (p: string, d: unknown) => void arquivos.set(p.split(/[/\\]/).pop()!, d)),
  readFile: vi.fn(async () => Buffer.from("%PDF")),
  statfs: vi.fn(async () => ({ bavail: 10 * 1024 ** 3, bsize: 1 })),
}));
const gravadas: Record<string, unknown[]> = { protheus_notas_entrega: [], protheus_notas_copia: [] };
vi.mock("./supabaseAdmin", () => ({
  getSupabaseAdmin: () => ({
    from: (t: string) => {
      const q = {
        select: () => q,
        eq: () => q,
        in: () => q,
        order: () => q,
        returns: async () => ({ data: t === "protheus_notas_copia" ? [] : [{ filial: "209", pedido: "013700", zae_id: "01" }] }),
        upsert: async (l: unknown) => {
          gravadas[t].push(l);
          return { error: null };
        },
      };
      return q;
    },
  }),
}));
vi.mock("./localPhotoStorage", () => ({ photoStorageDir: () => "/s/service-request-photos" }));
vi.mock("./totvsSync", () => ({ totvsHeaders: () => ({}), consertarAcentos: (s: string) => s }));

const { baixarNotaDaSaida, copiarNotasDeEntrega } = await import("./notaEntregaProtheus");
const CHAVE = "25260939537682000888550010000125641552162382";

beforeEach(() => {
  respostas.clear();
  chamadas.length = 0;
  arquivos.clear();
  gravadas.protheus_notas_entrega.length = 0;
  gravadas.protheus_notas_copia.length = 0;
});

describe("baixarNotaDaSaida", () => {
  it("guarda PDF e XML pela chave e registra a nota", async () => {
    respostas.set("/ai/deliveries/nota/209/013716/01", {
      status: 200,
      corpo: { invoice: "000012564", serie: "1", dataEmissao: "2026-09-11", chave: CHAVE, cfop: ["5117"], nfeXml: "<?xml?>", nfeBase64: Buffer.from("%PDF-1.3").toString("base64") },
    });
    const n = await baixarNotaDaSaida("209", "013716", "01");
    expect(n).toMatchObject({ chave: CHAVE, nota: "12564", cfop: "5117", emissao: "2026-09-11", tem_pdf: true, tem_xml: true });
    expect([...arquivos.keys()].sort()).toEqual([`${CHAVE}.pdf`, `${CHAVE}.xml`]);
    expect(gravadas.protheus_notas_entrega).toHaveLength(1);
  });
  it("na cópia de madrugada, nota com mais de 90 dias guarda só o XML", async () => {
    respostas.set("/ai/deliveries/nota/209/010000/01", {
      status: 200,
      corpo: { invoice: "000010000", serie: "1", dataEmissao: "2025-03-01", chave: CHAVE, cfop: "5117", nfeXml: "<?xml?>", nfeBase64: "JVBE" },
    });
    const n = await baixarNotaDaSaida("209", "010000", "01", { pdfSoRecente: true });
    expect(n).toMatchObject({ tem_pdf: false, tem_xml: true, emissao: "2025-03-01" });
    expect([...arquivos.keys()]).toEqual([`${CHAVE}.xml`]);
  });
  it("sem nota impressa (404) devolve null", async () => {
    expect(await baixarNotaDaSaida("209", "013716", "02")).toBeNull();
  });
});

describe("copiarNotasDeEntrega", () => {
  it("copia o dia, pula o que já tem, conta sem nota e marca o dia", async () => {
    respostas.set("/ai/deliveries?deliveryDateFrom=20261024&deliveryDateTo=20261024&page=1&size=50", {
      status: 200,
      corpo: { totalPages: 1, data: [{ branch: "209", order: "013700", id: "01" }, { branch: "209", order: "013716", id: "01" }, { branch: "209", order: "013717", id: "01" }] },
    });
    respostas.set("/ai/deliveries/nota/209/013716/01", { status: 200, corpo: { invoice: "12564", chave: CHAVE, nfeBase64: "JVBE" } });
    const r = await copiarNotasDeEntrega(60_000, "2026-10-24");
    expect(r).toMatchObject({ dias: ["2026-10-24"], entregas: 3, notas: 1, jaTinha: 1, semNota: 1, falhas: 0, parouPor: "fim" });
    expect(gravadas.protheus_notas_copia).toEqual([expect.objectContaining({ dia: "2026-10-24", entregas: 3, notas: 1, sem_nota: 1 })]);
    expect(chamadas.filter((c) => c.startsWith("/ai/deliveries/nota/209/013700"))).toEqual([]);
  });
});
