import { describe, expect, it } from "vitest";
import { saveMemory, searchMemory, updateMemory, deleteMemory } from "./index.js";

describe("memory", () => {
  it("saves and finds a memory by search", async () => {
    const saved = await saveMemory({ userId: "user_1", type: "USER_PREFERENCE", content: "Prefers concise answers" });
    const results = await searchMemory({ userId: "user_1", type: "USER_PREFERENCE" });
    expect(results.some((m) => m.id === saved.id)).toBe(true);
  });

  it("updates memory content", async () => {
    const saved = await saveMemory({ userId: "user_1", type: "SHORT_TERM", content: "original" });
    const updated = await updateMemory(saved.id, { content: "revised" });
    expect(updated.content).toBe("revised");
  });

  it("deletes memory", async () => {
    const saved = await saveMemory({ userId: "user_1", type: "SHORT_TERM", content: "temporary" });
    await deleteMemory(saved.id);
    const results = await searchMemory({ userId: "user_1", query: "temporary" });
    expect(results.find((m) => m.id === saved.id)).toBeUndefined();
  });

  it("never stores content that looks like a credential", async () => {
    await expect(
      saveMemory({ userId: "user_1", type: "LONG_TERM", content: "api_key: sk-abcdef1234567890" }),
    ).rejects.toThrow(/refusing to store/i);
  });

  it("allows content that merely mentions the word 'password' in passing", async () => {
    const saved = await saveMemory({
      userId: "user_1",
      type: "LONG_TERM",
      content: "The user asked how password managers work.",
    });
    expect(saved.content).toContain("password managers");
  });
});
