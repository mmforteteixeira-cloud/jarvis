import { describe, expect, it } from "vitest";
import { parseInformationIntent } from "./information-intent.js";

describe("parseInformationIntent", () => {
  it("parses a Portuguese weather question", () => {
    const result = parseInformationIntent("que tempo faz em Lisboa?");
    expect(result).toEqual({ kind: "weather", query: "Lisboa" });
  });

  it("parses an English weather question", () => {
    const result = parseInformationIntent("what's the weather like in Tokyo");
    expect(result).toEqual({ kind: "weather", query: "Tokyo" });
  });

  it("parses a Portuguese news question", () => {
    const result = parseInformationIntent("notícias sobre inteligência artificial");
    expect(result).toEqual({ kind: "news", query: "inteligência artificial" });
  });

  it("parses an English news question", () => {
    const result = parseInformationIntent("news about the stock market");
    expect(result).toEqual({ kind: "news", query: "the stock market" });
  });

  it("returns null for ordinary conversation", () => {
    expect(parseInformationIntent("How are you today?")).toBeNull();
    expect(parseInformationIntent("Cria uma aplicação de currículos")).toBeNull();
  });
});
