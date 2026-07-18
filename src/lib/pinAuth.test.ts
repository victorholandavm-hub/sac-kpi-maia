import { describe, it, expect, beforeAll } from "vitest";
import { hashPin, verifyPin, signPinSession, verifyPinSession } from "./pinAuth";

const TEST_ENV_VAR = "TEST_PIN_SESSION_SECRET";

beforeAll(() => {
  process.env[TEST_ENV_VAR] = "segredo-de-teste-nao-usar-em-producao";
});

describe("hashPin / verifyPin", () => {
  it("verifica o PIN certo como válido", () => {
    const hash = hashPin("1234");
    expect(verifyPin("1234", hash)).toBe(true);
  });

  it("rejeita um PIN errado", () => {
    const hash = hashPin("1234");
    expect(verifyPin("9999", hash)).toBe(false);
  });

  it("gera um hash no formato salt:hash", () => {
    const hash = hashPin("1234");
    expect(hash.split(":")).toHaveLength(2);
  });

  it("gera hashes diferentes pro mesmo PIN (salt aleatório)", () => {
    expect(hashPin("1234")).not.toBe(hashPin("1234"));
  });

  it("rejeita um valor de hash mal formado", () => {
    expect(verifyPin("1234", "sem-separador")).toBe(false);
  });
});

describe("signPinSession / verifyPinSession", () => {
  it("verifica com sucesso um token recém-assinado", () => {
    const token = signPinSession("Paulo", TEST_ENV_VAR);
    expect(verifyPinSession(token, TEST_ENV_VAR, 60_000)).toBe("Paulo");
  });

  it("rejeita um token adulterado (assinatura não bate mais)", () => {
    const token = signPinSession("Paulo", TEST_ENV_VAR);
    const [payload] = token.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ sub: "Eduardo", iat: Date.now() }), "utf8").toString("base64url");
    const forgedToken = `${forgedPayload}.${token.split(".")[1]}`;
    expect(forgedToken).not.toBe(token);
    expect(payload).toBeTruthy();
    expect(verifyPinSession(forgedToken, TEST_ENV_VAR, 60_000)).toBeNull();
  });

  it("rejeita um token assinado com outro segredo", () => {
    process.env["OUTRO_SEGREDO"] = "outro-valor-completamente-diferente";
    const token = signPinSession("Paulo", "OUTRO_SEGREDO");
    expect(verifyPinSession(token, TEST_ENV_VAR, 60_000)).toBeNull();
  });

  it("rejeita um token expirado", () => {
    const token = signPinSession("Paulo", TEST_ENV_VAR);
    // maxAgeMs negativo força qualquer tempo decorrido a já ter expirado.
    expect(verifyPinSession(token, TEST_ENV_VAR, -1)).toBeNull();
  });

  it("rejeita um token vazio ou nulo", () => {
    expect(verifyPinSession(null, TEST_ENV_VAR, 60_000)).toBeNull();
    expect(verifyPinSession(undefined, TEST_ENV_VAR, 60_000)).toBeNull();
    expect(verifyPinSession("", TEST_ENV_VAR, 60_000)).toBeNull();
  });

  it("rejeita um token sem o separador ponto", () => {
    expect(verifyPinSession("payload-sem-assinatura", TEST_ENV_VAR, 60_000)).toBeNull();
  });

  it("lança erro se a variável de ambiente do segredo não existir", () => {
    expect(() => signPinSession("Paulo", "VAR_QUE_NAO_EXISTE")).toThrow();
  });
});
