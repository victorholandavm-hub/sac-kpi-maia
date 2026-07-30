import { describe, it, expect } from "vitest";
import { buildArsenalSlug } from "./arsenalSac";

describe("buildArsenalSlug", () => {
  it("normaliza acento, caixa e pontuação", () => {
    expect(buildArsenalSlug("cdc", "Art. 18 CDC — vício do produto")).toBe("cdc-art-18-cdc-vicio-do-produto");
  });

  it("normaliza acentos de colchão/garantia", () => {
    expect(buildArsenalSlug("garantias", "Colchões — prazo de garantia")).toBe("garantias-colchoes-prazo-de-garantia");
  });

  it("mesma categoria+título sempre produz o mesmo slug (idempotência do seed)", () => {
    const a = buildArsenalSlug("fornecedores", "Probel — colchões");
    const b = buildArsenalSlug("fornecedores", "Probel — colchões");
    expect(a).toBe(b);
  });
});
