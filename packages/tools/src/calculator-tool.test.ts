import { describe, expect, it } from "vitest";
import { evaluateExpression, CalculatorError } from "./calculator-tool.js";

describe("evaluateExpression", () => {
  it("respects operator precedence", () => {
    expect(evaluateExpression("2 + 3 * 4")).toBe(14);
  });

  it("respects parentheses", () => {
    expect(evaluateExpression("(2 + 3) * 4")).toBe(20);
  });

  it("handles unary minus", () => {
    expect(evaluateExpression("-5 + 10")).toBe(5);
  });

  it("handles exponentiation", () => {
    expect(evaluateExpression("2 ^ 10")).toBe(1024);
  });

  it("handles decimals with comma or dot", () => {
    expect(evaluateExpression("1,5 + 1.5")).toBe(3);
  });

  it("throws on division by zero", () => {
    expect(() => evaluateExpression("1 / 0")).toThrow(CalculatorError);
  });

  it("throws on unsupported characters instead of evaluating them", () => {
    expect(() => evaluateExpression("2 + alert('x')")).toThrow(CalculatorError);
  });

  it("throws on unbalanced parentheses", () => {
    expect(() => evaluateExpression("(2 + 3")).toThrow(CalculatorError);
  });
});
