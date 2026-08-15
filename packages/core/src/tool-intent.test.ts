import { describe, expect, it } from "vitest";
import { parseToolIntent } from "./tool-intent.js";

describe("parseToolIntent (heuristic mode — no AI key in test env)", () => {
  it("extracts OPEN_APPLICATION even with a name prefix before the verb", async () => {
    const intent = await parseToolIntent("JARVIS, abre o Safari.");
    expect(intent).toEqual({
      agentType: "COMPUTER",
      tool: "OPEN_APPLICATION",
      input: { application: "Safari" },
      description: "Open Safari",
    });
  });

  it("resolves an alias to its canonical app label", async () => {
    const intent = await parseToolIntent("JARVIS, abre o VS Code.");
    expect(intent?.input).toEqual({ application: "Visual Studio Code" });
  });

  it("extracts CREATE_DIRECTORY with the folder name", async () => {
    const intent = await parseToolIntent("JARVIS, cria uma pasta chamada Teste.");
    expect(intent).toMatchObject({ tool: "CREATE_DIRECTORY", input: { path: "Teste" } });
  });

  it("extracts SCREENSHOT", async () => {
    const intent = await parseToolIntent("JARVIS, tira um screenshot.");
    expect(intent).toMatchObject({ tool: "SCREENSHOT" });
  });

  it("extracts OPEN_URL and normalizes a bare domain to https", async () => {
    const intent = await parseToolIntent("abre o site google.com");
    expect(intent).toMatchObject({ tool: "OPEN_URL", input: { url: "https://google.com" } });
  });

  it("extracts OPEN_URL from an explicit https URL", async () => {
    const intent = await parseToolIntent("abre https://example.com");
    expect(intent).toMatchObject({ tool: "OPEN_URL", input: { url: "https://example.com" } });
  });

  it("extracts LIST_DIRECTORY", async () => {
    const intent = await parseToolIntent("lista os ficheiros");
    expect(intent).toMatchObject({ tool: "LIST_DIRECTORY", input: { path: "." } });
  });

  it("returns null for a non-allow-listed application", async () => {
    expect(await parseToolIntent("abre o Notepad")).toBeNull();
  });

  it("returns null for ordinary chat", async () => {
    expect(await parseToolIntent("Ola, como estas?")).toBeNull();
  });

  it("never infers RUN_COMMAND from vague natural language", async () => {
    expect(await parseToolIntent("JARVIS, executa o projeto.")).toBeNull();
    expect(await parseToolIntent("JARVIS, verifica se o servidor está a funcionar.")).toBeNull();
  });
});
