import { describe, expect, it } from "vitest";
import { parseUtilityIntent } from "./utility-intent.js";

describe("parseUtilityIntent", () => {
  it("evaluates a bare arithmetic expression", () => {
    const result = parseUtilityIntent("2+2*3");
    expect(result?.kind).toBe("calculator");
    expect(result?.reply).toContain("= 8");
  });

  it("evaluates a calculation with a natural-language trigger", () => {
    const result = parseUtilityIntent("quanto é 15 * 4?");
    expect(result?.kind).toBe("calculator");
    expect(result?.reply).toContain("= 60");
  });

  it("handles percentage-of phrasing", () => {
    const result = parseUtilityIntent("what is 20% of 150");
    expect(result?.kind).toBe("calculator");
    expect(result?.reply).toContain("= 30");
  });

  it("answers a date/time question", () => {
    const result = parseUtilityIntent("que horas são?");
    expect(result?.kind).toBe("datetime");
    expect(result?.reply).toMatch(/It's .+ on .+,/);
  });

  it("does not misfire on a bare number with no operator", () => {
    expect(parseUtilityIntent("what is 2024")).toBeNull();
  });

  it("does not misfire on ordinary conversation", () => {
    expect(parseUtilityIntent("How are you today?")).toBeNull();
    expect(parseUtilityIntent("Cria uma aplicação de currículos")).toBeNull();
  });

  it("returns null instead of throwing on division by zero", () => {
    expect(parseUtilityIntent("quanto é 5 / 0")).toBeNull();
  });
});
