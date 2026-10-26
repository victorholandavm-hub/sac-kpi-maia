import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./rotaMotorista", () => ({ exigirCargaDoMotorista: vi.fn() }));
vi.mock("./logistica", async (orig) => {
  const real = await orig<typeof import("./logistica")>();
  return { ...real, registrarResultadoParada: vi.fn() };
});

import { exigirCargaDoMotorista } from "./rotaMotorista";
import { OdooBridgeError, registrarResultadoParada } from "./logistica";
import { registrarBaixaParada } from "./baixaParada";
import { classificarErroBaixa, criarDedupEventos, observacaoComHorario } from "./baixaIdempotencia";

const sessao = { nome: "JOAO", supervisor: false };
const exigir = vi.mocked(exigirCargaDoMotorista);
const registrar = vi.mocked(registrarResultadoParada);

function carga(resultado: string | false = false) {
  return { carga: { estado: "em_rota", paradas: [{ parada_id: 7, resultado }] }, employeeId: 99 } as never;
}
const ok = { carga_id: 28, parada_id: 7, resultado: "entregue", seq_executada: 1, pendentes: 2, estado_carga: "em_rota" } as const;

beforeEach(() => {
  exigir.mockReset();
  registrar.mockReset();
});

describe("registrarBaixaParada (rota da fila offline)", () => {
  it("sem sessão = 'sessao' (fica na fila)", async () => {
    const r = await registrarBaixaParada(null, { cargaId: 28, paradaId: 7, resultado: "entregue", fotoTipos: ["canhoto", "mercadoria"] });
    expect(r).toMatchObject({ ok: false, tipo: "sessao" });
  });
  it("manda evento_uid para a ponte e o mesmo uid reenviado não registra 2x", async () => {
    exigir.mockResolvedValue(carga());
    registrar.mockResolvedValue({ ...ok });
    const uid = "3f1c2e9a-1b2c-4d3e-8f40-0a1b2c3d4e5f";
    const e = { cargaId: 28, paradaId: 7, resultado: "entregue" as const, fotoTipos: ["canhoto", "mercadoria"], eventoUid: uid };
    const r1 = await registrarBaixaParada(sessao, e);
    const r2 = await registrarBaixaParada(sessao, e);
    expect(r1).toEqual({ ok: true, dados: ok });
    expect(r2).toEqual(r1);
    expect(registrar).toHaveBeenCalledTimes(1);
    expect(registrar.mock.calls[0][1]).toMatchObject({ evento_uid: uid, origem: "app", motorista_id: 99 });
  });
  it("parada que já tem resultado = 'ja_registrada' (sai da fila)", async () => {
    exigir.mockResolvedValue(carga("entregue"));
    const r = await registrarBaixaParada(sessao, { cargaId: 28, paradaId: 7, resultado: "entregue", fotoTipos: ["canhoto", "mercadoria"], eventoUid: "5a1c2e9a-1b2c-4d3e-8f40-0a1b2c3d4e5f" });
    expect(r).toMatchObject({ ok: false, tipo: "ja_registrada" });
    expect(registrar).not.toHaveBeenCalled();
  });
  it("Odoo fora = 'transitorio' e libera o uid para a próxima tentativa", async () => {
    exigir.mockResolvedValue(carga());
    registrar.mockRejectedValueOnce(new OdooBridgeError("Odoo não respondeu em 20 s", "/logistica/parada/7", null)).mockResolvedValueOnce({ ...ok });
    const e = { cargaId: 28, paradaId: 7, resultado: "entregue" as const, fotoTipos: ["canhoto", "mercadoria"], eventoUid: "6b1c2e9a-1b2c-4d3e-8f40-0a1b2c3d4e5f" };
    expect(await registrarBaixaParada(sessao, e)).toMatchObject({ ok: false, tipo: "transitorio" });
    expect(await registrarBaixaParada(sessao, e)).toMatchObject({ ok: true });
  });
  it("recusa do Odoo (400) = 'recusada'; insucesso sem motivo nem chega na ponte", async () => {
    exigir.mockResolvedValue(carga());
    registrar.mockRejectedValueOnce(new OdooBridgeError("motivo X não existe", "/logistica/parada/7", 400));
    expect(await registrarBaixaParada(sessao, { cargaId: 28, paradaId: 7, resultado: "insucesso", motivo: "X", fotoTipos: ["local"] })).toMatchObject({ ok: false, tipo: "recusada", erro: "motivo X não existe" });
    expect(await registrarBaixaParada(sessao, { cargaId: 28, paradaId: 7, resultado: "insucesso" })).toMatchObject({ ok: false, tipo: "recusada" });
    expect(registrar).toHaveBeenCalledTimes(1);
  });
  it("baixa feita offline leva a hora real do toque na observação", async () => {
    exigir.mockResolvedValue(carga());
    registrar.mockResolvedValue({ ...ok });
    await registrarBaixaParada(sessao, { cargaId: 28, paradaId: 7, resultado: "entregue", fotoTipos: ["canhoto", "mercadoria"], obs: "porteiro", registradoEm: new Date(Date.now() - 3600_000).toISOString() });
    expect(registrar.mock.calls[0][1].obs).toMatch(/^\[baixa offline \d{2}\/\d{2} \d{2}:\d{2}\] porteiro · fotos: canhoto, mercadoria$/);
  });
});

describe("baixaIdempotencia", () => {
  it("classifica erro de transporte x recusa", () => {
    expect(classificarErroBaixa(new OdooBridgeError("x", "r", null))).toBe("transitorio");
    expect(classificarErroBaixa(new OdooBridgeError("x", "r", 502))).toBe("transitorio");
    expect(classificarErroBaixa(new OdooBridgeError("x", "r", 401))).toBe("transitorio");
    expect(classificarErroBaixa(new OdooBridgeError("x", "r", 400))).toBe("recusada");
    expect(classificarErroBaixa(new Error("Essa carga não é sua."))).toBe("recusada");
  });
  it("dedup: andamento expira, feito expira pelo TTL", () => {
    const d = criarDedupEventos<string>({ ttlMs: 1000, andamentoMaxMs: 100 });
    expect(d.iniciar("u", 0)).toEqual({ tipo: "novo" });
    expect(d.iniciar("u", 50)).toEqual({ tipo: "andamento" });
    expect(d.iniciar("u", 200)).toEqual({ tipo: "novo" });
    d.concluir("u", "R", 300);
    expect(d.iniciar("u", 900)).toEqual({ tipo: "feito", resposta: "R" });
    expect(d.iniciar("u", 1400)).toEqual({ tipo: "novo" });
  });
  it("observação: baixa em tempo real não ganha prefixo", () => {
    const agora = Date.parse("2026-10-25T15:00:00Z");
    expect(observacaoComHorario("ok", "2026-10-25T14:59:30Z", agora)).toBe("ok");
    expect(observacaoComHorario(null, "2026-10-25T13:05:00Z", agora)).toBe("[baixa offline 25/10 10:05]");
    expect(observacaoComHorario("  ", null, agora)).toBeNull();
  });
});
