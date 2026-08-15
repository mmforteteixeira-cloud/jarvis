import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { WorkspaceSandbox } from "./sandbox.js";

describe("WorkspaceSandbox", () => {
  const sandbox = new WorkspaceSandbox("/tmp/jarvis-sandbox-test-root");

  it("resolves a relative path inside the root", () => {
    expect(sandbox.resolve("notes.txt")).toBe(resolve("/tmp/jarvis-sandbox-test-root", "notes.txt"));
  });

  it("resolves a nested relative path inside the root", () => {
    expect(sandbox.resolve("a/b/c.txt")).toBe(resolve("/tmp/jarvis-sandbox-test-root", "a/b/c.txt"));
  });

  it("resolves the root itself", () => {
    expect(sandbox.resolve(".")).toBe(resolve("/tmp/jarvis-sandbox-test-root"));
  });

  it("rejects simple path traversal", () => {
    expect(() => sandbox.resolve("../outside.txt")).toThrow(/resolves outside/);
  });

  it("rejects deep path traversal", () => {
    expect(() => sandbox.resolve("a/b/../../../etc/passwd")).toThrow(/resolves outside/);
  });

  it("rejects an absolute path outside the root", () => {
    expect(() => sandbox.resolve("/etc/passwd")).toThrow(/resolves outside/);
  });

  it("rejects a sibling directory that merely shares a prefix", () => {
    // e.g. root "/tmp/jarvis-sandbox-test-root" vs "/tmp/jarvis-sandbox-test-root-evil"
    expect(() => sandbox.resolve("/tmp/jarvis-sandbox-test-root-evil/file.txt")).toThrow(/resolves outside/);
  });

  it("isInside reports correctly", () => {
    expect(sandbox.isInside(resolve("/tmp/jarvis-sandbox-test-root", "a/b.txt"))).toBe(true);
    expect(sandbox.isInside("/etc/passwd")).toBe(false);
  });
});
