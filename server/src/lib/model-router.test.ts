import { describe, it, expect } from "vitest";
import {
  classifyComplexity,
  pickModel,
  type TaskDifficulty,
} from "./model-router";

describe("classifyComplexity", () => {
  it("klasificira kratak upit kao simple", () => {
    expect(classifyComplexity("objasni šta je dijagram toka")).toBe("simple");
  });

  it("klasificira upit s 2+ kompleksna markera kao complex", () => {
    expect(
      classifyComplexity(
        "implementiraj kompletnu arhitekturu baze sa security slojem"
      )
    ).toBe("complex");
  });

  it("klasificira duži tekst (>500 znakova) kao complex", () => {
    const long = "a".repeat(501);
    expect(classifyComplexity(long)).toBe("complex");
  });

  it("klasificira tekst bez markera kao moderate", () => {
    expect(
      classifyComplexity(
        "mogu li dobiti kratak pregled statusa svih zadataka u projektu danas"
      )
    ).toBe("moderate");
  });

  it("je case-insensitive", () => {
    expect(classifyComplexity("OBJASNI STA JE X")).toBe("simple");
  });

  it("prazan string se tretira kao simple (kraci od 50)", () => {
    expect(classifyComplexity("")).toBe("simple");
  });

  it("granica dužine: 49 znakova → simple", () => {
    const text = "x".repeat(49);
    expect(classifyComplexity(text)).toBe("simple");
  });

  it("granica dužine: 50 znakova → moderate (bez markera)", () => {
    const text = "x".repeat(50);
    expect(classifyComplexity(text)).toBe("moderate");
  });

  it("granica dužine: 500 znakova → moderate", () => {
    const text = "x".repeat(500);
    expect(classifyComplexity(text)).toBe("moderate");
  });

  it("granica dužine: 501 znakova → complex", () => {
    const text = "x".repeat(501);
    expect(classifyComplexity(text)).toBe("complex");
  });

  it("jedan kompleksan marker u kratkom tekstu ne čini complex", () => {
    expect(classifyComplexity("deploy this")).not.toBe("complex");
  });
});

describe("pickModel", () => {
  it("vraća prvi dostupan provider iz ljestvice (openai prije google u simple)", () => {
    const available = new Set(["google", "openai"]);
    const result = pickModel("simple", available);
    expect(result).toEqual({
      providerId: "openai",
      modelId: "gpt-4o-mini",
      reason: "Brzo i jeftino za jednostavne upite",
    });
  });

  it("preskače nedostupne providere", () => {
    const available = new Set(["deepseek"]);
    const result = pickModel("complex", available);
    expect(result?.providerId).toBe("deepseek");
    expect(result?.modelId).toBe("deepseek-r1");
  });

  it("vraća null kada nijedan provider nije dostupan", () => {
    const available = new Set<string>();
    expect(pickModel("moderate", available)).toBeNull();
  });

  it("vraća anthropic prvi za complex kada je dostupan", () => {
    const available = new Set(["anthropic", "openai"]);
    const result = pickModel("complex", available);
    expect(result?.providerId).toBe("anthropic");
    expect(result?.modelId).toBe("claude-opus-5");
  });

  it("ne puca na thinking parametru (ignoriran)", () => {
    const available = new Set(["anthropic"]);
    const result = pickModel("simple", available, "neki thinking");
    expect(result?.providerId).toBe("anthropic");
  });

  it("svaka težina ima validnu ljestvicu", () => {
    const diffs: TaskDifficulty[] = ["simple", "moderate", "complex"];
    for (const d of diffs) {
      const result = pickModel(d, new Set(["anthropic", "openai", "google", "deepseek"]));
      expect(result).not.toBeNull();
    }
  });
});
